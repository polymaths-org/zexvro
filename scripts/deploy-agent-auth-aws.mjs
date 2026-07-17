#!/usr/bin/env node
/**
 * Deploy skeleton for ZEXVRO Gate (agent-auth) to AWS.
 *
 * Creates (idempotent-ish sketches):
 *  - DynamoDB table zexvro-agent-auth (pk/sk + TTL)
 *  - ECR repo zexvro-agent-auth
 *  - Secrets Manager placeholder for signing secret
 *  - App Runner service (requires image push first)
 *
 * Usage:
 *   node scripts/deploy-agent-auth-aws.mjs --plan
 *   node scripts/deploy-agent-auth-aws.mjs --apply-table
 *   node scripts/deploy-agent-auth-aws.mjs --apply-secret
 *
 * Full image build/push left explicit for safety (disk + cost).
 */
import { spawnSync } from 'node:child_process'

const region = process.env.AWS_REGION || 'us-east-1'
const tableName = process.env.GATE_DYNAMO_TABLE || 'zexvro-agent-auth'
const secretName = process.env.GATE_SIGNING_SECRET_NAME || 'zexvro/agent-auth/issuer-signing'
const ecrRepo = process.env.GATE_ECR_REPO || 'zexvro-agent-auth'
const args = new Set(process.argv.slice(2))

function aws(argv) {
  const r = spawnSync('aws', [...argv, '--region', region], { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    process.exit(r.status || 1)
  }
  return r.stdout
}

function plan() {
  console.log(`Region: ${region}`)
  console.log(`DynamoDB table: ${tableName}`)
  console.log(`  pk: S, sk: S, TTL attr: ttl`)
  console.log(`Secret: ${secretName}`)
  console.log(`ECR: ${ecrRepo}`)
  console.log(`App Runner: zexvro-agent-auth (0.25 vCPU / 0.5 GB)`)
  console.log(`Env: NODE_ENV=production GATE_REQUIRE_POP=true AGENT_AUTH_ISSUER=<service-url>`)
  console.log(`Codec: services/agent-auth/src/stores.dynamo.ts`)
  console.log(`\nSteps:`)
  console.log(` 1. node scripts/deploy-agent-auth-aws.mjs --apply-all-infra`)
  console.log(` 2. Start docker, then:`)
  console.log(`      docker build -t ${ecrRepo}:latest services/agent-auth`)
  console.log(`      aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.${region}.amazonaws.com`)
  console.log(`      docker tag ${ecrRepo}:latest <uri>:latest && docker push <uri>:latest`)
  console.log(` 3. Create IAM roles from docs/iam/gate-apprunner-*.json`)
  console.log(` 4. Create App Runner service (image + Dynamo + secret env)`)
  console.log(` 5. Set AGENT_AUTH_ISSUER to App Runner URL, GATE_STATE_BACKEND=dynamo`)
}

function applyTable() {
  // Check exists
  const list = aws(['dynamodb', 'list-tables', '--output', 'json'])
  const tables = JSON.parse(list).TableNames || []
  if (tables.includes(tableName)) {
    console.log(`Table ${tableName} already exists`)
    return
  }
  console.log(`Creating table ${tableName}...`)
  aws([
    'dynamodb',
    'create-table',
    '--table-name',
    tableName,
    '--attribute-definitions',
    'AttributeName=pk,AttributeType=S',
    'AttributeName=sk,AttributeType=S',
    '--key-schema',
    'AttributeName=pk,KeyType=HASH',
    'AttributeName=sk,KeyType=RANGE',
    '--billing-mode',
    'PAY_PER_REQUEST',
  ])
  console.log('Waiting for table ACTIVE...')
  aws(['dynamodb', 'wait', 'table-exists', '--table-name', tableName])
  console.log('Enabling TTL on ttl attribute...')
  aws([
    'dynamodb',
    'update-time-to-live',
    '--table-name',
    tableName,
    '--time-to-live-specification',
    'Enabled=true,AttributeName=ttl',
  ])
  console.log('Done')
}

function applySecret() {
  const list = aws(['secretsmanager', 'list-secrets', '--output', 'json'])
  const names = (JSON.parse(list).SecretList || []).map((s) => s.Name)
  if (names.includes(secretName)) {
    console.log(`Secret ${secretName} already exists`)
    return
  }
  const value = `dev-rotate-me-${Date.now()}`
  console.log(`Creating secret ${secretName} (rotate immediately)...`)
  aws([
    'secretsmanager',
    'create-secret',
    '--name',
    secretName,
    '--secret-string',
    value,
  ])
  console.log('Created — rotate value before production traffic')
}

function applyEcr() {
  try {
    const out = aws(['ecr', 'describe-repositories', '--repository-names', ecrRepo, '--output', 'json'])
    const uri = JSON.parse(out).repositories?.[0]?.repositoryUri
    console.log(`ECR exists: ${uri || ecrRepo}`)
  } catch {
    const out = aws([
      'ecr',
      'create-repository',
      '--repository-name',
      ecrRepo,
      '--image-scanning-configuration',
      'scanOnPush=true',
      '--encryption-configuration',
      'encryptionType=AES256',
      '--output',
      'json',
    ])
    const uri = JSON.parse(out).repository?.repositoryUri
    console.log(`Created ECR: ${uri}`)
  }
}

if (args.has('--apply-table')) applyTable()
else if (args.has('--apply-secret')) applySecret()
else if (args.has('--apply-ecr')) applyEcr()
else if (args.has('--apply-all-infra')) {
  applyTable()
  applySecret()
  applyEcr()
} else plan()
