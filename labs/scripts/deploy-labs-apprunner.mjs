#!/usr/bin/env node
/**
 * Create/update App Runner service for ZEXVRO Labs.
 *
 * Prerequisites:
 *  - Image pushed to ECR: 290294660486.dkr.ecr.us-east-1.amazonaws.com/zexvro-labs:latest
 *  - Dynamo table zexvro-labs + IAM roles (see scripts/deploy-labs-aws.mjs)
 *  - GitHub OAuth client id/secret stored in Secrets Manager or passed via env
 *
 * Usage:
 *   node scripts/deploy-labs-apprunner.mjs
 *   IMAGE_TAG=abc123 node scripts/deploy-labs-apprunner.mjs
 */
import { spawnSync } from 'node:child_process'

const region = process.env.AWS_REGION || 'us-east-1'
const account = process.env.AWS_ACCOUNT_ID || '290294660486'
const serviceName = 'zexvro-labs'
const ecrRepo = process.env.LABS_ECR_REPO || 'zexvro-labs'
const tag = process.env.IMAGE_TAG || 'latest'
const image = `${account}.dkr.ecr.${region}.amazonaws.com/${ecrRepo}:${tag}`
const appUrl = process.env.LABS_APP_URL || 'https://labs.zexvro.in'
const instanceRole = `arn:aws:iam::${account}:role/zexvro-labs-apprunner-instance`
const accessRole = `arn:aws:iam::${account}:role/zexvro-apprunner-ecr-access`

function awsJson(args) {
  const r = spawnSync('aws', [...args, '--region', region, '--output', 'json'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    throw new Error(`aws ${args[0]} failed`)
  }
  return r.stdout ? JSON.parse(r.stdout) : null
}

function resolveSecretArn(name) {
  try {
    return awsJson(['secretsmanager', 'describe-secret', '--secret-id', name]).ARN
  } catch {
    return `arn:aws:secretsmanager:${region}:${account}:secret:${name}`
  }
}

const sourceConfig = {
  AuthenticationConfiguration: { AccessRoleArn: accessRole },
  AutoDeploymentsEnabled: false,
  ImageRepository: {
    ImageIdentifier: image,
    ImageRepositoryType: 'ECR',
    ImageConfiguration: {
      Port: '3000',
      RuntimeEnvironmentVariables: {
        NODE_ENV: 'production',
        PORT: '3000',
        APP_URL: appUrl,
        LABS_STATE_BACKEND: 'dynamo',
        LABS_DYNAMO_REGION: region,
        LABS_DYNAMO_TABLE: 'zexvro-labs',
        LABS_ADMIN_GITHUB_LOGINS: process.env.LABS_ADMIN_GITHUB_LOGINS || 'zexvro',
        AWS_REGION: region,
      },
      RuntimeEnvironmentSecrets: {
        LABS_SESSION_SECRET: resolveSecretArn('zexvro/labs/session'),
        GITHUB_CLIENT_ID: resolveSecretArn('zexvro/github/client-id'),
        GITHUB_CLIENT_SECRET: resolveSecretArn('zexvro/github/client-secret'),
        GEMINI_API_KEY: resolveSecretArn('zexvro/labs/gemini'),
      },
    },
  },
}

const instanceConfig = {
  Cpu: '0.25 vCPU',
  Memory: '0.5 GB',
  InstanceRoleArn: instanceRole,
}

const healthCheck = {
  Protocol: 'HTTP',
  Path: '/api/health',
  Interval: 10,
  Timeout: 5,
  HealthyThreshold: 1,
  UnhealthyThreshold: 5,
}

const list = awsJson(['apprunner', 'list-services'])
const existing = (list.ServiceSummaryList || []).find((s) => s.ServiceName === serviceName)

if (existing) {
  console.log(`Updating App Runner ${serviceName} → ${image}`)
  const out = awsJson([
    'apprunner', 'update-service',
    '--service-arn', existing.ServiceArn,
    '--source-configuration', JSON.stringify(sourceConfig),
    '--instance-configuration', JSON.stringify(instanceConfig),
    '--health-check-configuration', JSON.stringify(healthCheck),
  ])
  console.log(JSON.stringify({ serviceUrl: out.Service?.ServiceUrl, status: out.Service?.Status }, null, 2))
} else {
  console.log(`Creating App Runner ${serviceName} → ${image}`)
  const out = awsJson([
    'apprunner', 'create-service',
    '--service-name', serviceName,
    '--source-configuration', JSON.stringify(sourceConfig),
    '--instance-configuration', JSON.stringify(instanceConfig),
    '--health-check-configuration', JSON.stringify(healthCheck),
  ])
  console.log(JSON.stringify({ serviceUrl: out.Service?.ServiceUrl, status: out.Service?.Status }, null, 2))
}

console.log(`
Next:
  1. Wait until Status=RUNNING
  2. curl https://<ServiceUrl>/api/health
  3. Cloudflare DNS: CNAME labs → <ServiceUrl>
  4. GitHub OAuth app callback: ${appUrl}/auth/callback
  5. Register the callback URL above in your GitHub OAuth app.
`)