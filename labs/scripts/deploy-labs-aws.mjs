#!/usr/bin/env node
/**
 * Provision AWS infrastructure for ZEXVRO Labs.
 *
 * Creates (idempotent):
 *  - DynamoDB table zexvro-labs (pk/sk + GSI gsi1pk-index + TTL on ttl)
 *  - ECR repository zexvro-labs
 *  - App Runner IAM roles: zexvro-labs-apprunner-instance + reuse zexvro-apprunner-ecr-access
 *  - Secrets Manager placeholder zexvro/labs/session (rotate before prod)
 *
 * Usage:
 *   node scripts/deploy-labs-aws.mjs --plan
 *   node scripts/deploy-labs-aws.mjs --apply-all-infra
 *
 * Image build/push + App Runner service are handled by scripts/deploy-labs-apprunner.mjs
 */
import { spawnSync } from 'node:child_process'

const region = process.env.AWS_REGION || 'us-east-1'
const account = process.env.AWS_ACCOUNT_ID || '290294660486'
const tableName = process.env.LABS_DYNAMO_TABLE || 'zexvro-labs'
const ecrRepo = process.env.LABS_ECR_REPO || 'zexvro-labs'
const sessionSecretName = 'zexvro/labs/session'
const instanceRole = 'zexvro-labs-apprunner-instance'
const args = new Set(process.argv.slice(2))

function aws(argv) {
  const r = spawnSync('aws', [...argv, '--region', region], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    process.exit(r.status || 1)
  }
  return r.stdout
}

function awsJson(argv) {
  return JSON.parse(aws(argv))
}

function plan() {
  console.log(`Region: ${region}`)
  console.log(`DynamoDB table: ${tableName} (pk S, sk S, GSI gsi1pk-index, TTL: ttl)`)
  console.log(`ECR: ${ecrRepo}`)
  console.log(`IAM: ${instanceRole} (App Runner instance; DynamoDB + SecretsManager)`)
  console.log(`     zexvro-apprunner-ecr-access (reused ECR read role)`)
  console.log(`Secret: ${sessionSecretName}`)
  console.log(`\nSteps:`)
  console.log(` 1. node scripts/deploy-labs-aws.mjs --apply-all-infra`)
  console.log(` 2. Set GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET in GitHub OAuth app (callback = APP_URL/auth/callback)`)
  console.log(` 3. node scripts/deploy-labs-apprunner.mjs`)
}

function applyTable() {
  const list = awsJson(['dynamodb', 'list-tables'])
  if ((list.TableNames || []).includes(tableName)) {
    console.log(`Table ${tableName} already exists`)
    return
  }
  console.log(`Creating DynamoDB table ${tableName}...`)
  aws([
    'dynamodb', 'create-table',
    '--table-name', tableName,
    '--attribute-definitions',
    'AttributeName=pk,AttributeType=S',
    'AttributeName=sk,AttributeType=S',
    'AttributeName=gsi1pk,AttributeType=S',
    'AttributeName=gsi1sk,AttributeType=S',
    '--key-schema',
    'AttributeName=pk,KeyType=HASH',
    'AttributeName=sk,KeyType=RANGE',
    '--global-secondary-indexes',
    '[{"IndexName":"gsi1pk-index","KeySchema":[{"AttributeName":"gsi1pk","KeyType":"HASH"},{"AttributeName":"gsi1sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]',
    '--billing-mode', 'PAY_PER_REQUEST',
  ])
  console.log('Waiting for table ACTIVE...')
  aws(['dynamodb', 'wait', 'table-exists', '--table-name', tableName])
  console.log('Enabling TTL on ttl attribute...')
  aws([
    'dynamodb', 'update-time-to-live',
    '--table-name', tableName,
    '--time-to-live-specification', 'Enabled=true,AttributeName=ttl',
  ])
  console.log('Done')
}

function applyEcr() {
  try {
    const out = awsJson(['ecr', 'describe-repositories', '--repository-names', ecrRepo])
    console.log(`ECR exists: ${out.repositories?.[0]?.repositoryUri || ecrRepo}`)
  } catch {
    const out = awsJson([
      'ecr', 'create-repository',
      '--repository-name', ecrRepo,
      '--image-scanning-configuration', 'scanOnPush=true',
      '--encryption-configuration', 'encryptionType=AES256',
    ])
    console.log(`Created ECR: ${out.repository?.repositoryUri}`)
  }
}

function applyRole() {
  const roles = awsJson(['iam', 'list-roles']).Roles.map((r) => r.RoleName)
  if (roles.includes(instanceRole)) {
    console.log(`Role ${instanceRole} already exists`)
    return
  }
  console.log(`Creating App Runner instance role ${instanceRole}...`)
  aws([
    'iam', 'create-role',
    '--role-name', instanceRole,
    '--assume-role-policy-document',
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { Service: 'tasks.apprunner.amazonaws.com' },
        Action: 'sts:AssumeRole',
      }],
    }),
  ])
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan', 'dynamodb:UpdateItem'],
        Resource: [
          `arn:aws:dynamodb:${region}:${account}:table/${tableName}`,
          `arn:aws:dynamodb:${region}:${account}:table/${tableName}/index/*`,
        ],
      },
      {
        Effect: 'Allow',
        Action: ['secretsmanager:GetSecretValue'],
        Resource: [
          `arn:aws:secretsmanager:${region}:${account}:secret:zexvro/labs/*`,
          `arn:aws:secretsmanager:${region}:${account}:secret:zexvro/github/*`,
        ],
      },
    ],
  }
  aws([
    'iam', 'put-role-policy',
    '--role-name', instanceRole,
    '--policy-name', 'LabsDynamoAndSecrets',
    '--policy-document', JSON.stringify(policy),
  ])
  console.log('Role created.')
}

function applySecret() {
  const secrets = awsJson(['secretsmanager', 'list-secrets']).SecretList || []
  if (secrets.some((s) => s.Name === sessionSecretName)) {
    console.log(`Secret ${sessionSecretName} already exists`)
    return
  }
  const value = `dev-rotate-me-${Date.now()}`
  console.log(`Creating secret ${sessionSecretName} (rotate immediately)...`)
  aws(['secretsmanager', 'create-secret', '--name', sessionSecretName, '--secret-string', value])
}

if (args.has('--apply-all-infra')) {
  applyTable()
  applyEcr()
  applyRole()
  applySecret()
} else {
  plan()
}