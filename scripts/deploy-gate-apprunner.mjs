#!/usr/bin/env node
/**
 * Create/update App Runner service for ZEXVRO Gate (agent-auth).
 *
 * Prerequisites:
 *  - Image pushed to ECR: 290294660486.dkr.ecr.us-east-1.amazonaws.com/zexvro-agent-auth:latest
 *  - Dynamo table zexvro-agent-auth
 *  - Secret zexvro/agent-auth/issuer-signing
 *  - IAM roles zexvro-gate-apprunner-instance + zexvro-apprunner-ecr-access
 *
 * Usage:
 *   node scripts/deploy-gate-apprunner.mjs
 *   IMAGE_TAG=abc123 node scripts/deploy-gate-apprunner.mjs
 */
import { spawnSync } from 'node:child_process'

const region = process.env.AWS_REGION || 'us-east-1'
const account = process.env.AWS_ACCOUNT_ID || '290294660486'
const serviceName = process.env.GATE_APPRUNNER_SERVICE || 'zexvro-agent-auth'
const ecrRepo = process.env.GATE_ECR_REPO || 'zexvro-agent-auth'
const tag = process.env.IMAGE_TAG || 'latest'
const image = `${account}.dkr.ecr.${region}.amazonaws.com/${ecrRepo}:${tag}`
const issuer = process.env.AGENT_AUTH_ISSUER || 'https://api.zexvro.in/gate'
const secretArn =
  process.env.GATE_SIGNING_SECRET_ARN ||
  `arn:aws:secretsmanager:${region}:${account}:secret:zexvro/agent-auth/issuer-signing`
const instanceRole =
  process.env.GATE_INSTANCE_ROLE_ARN ||
  `arn:aws:iam::${account}:role/zexvro-gate-apprunner-instance`
const accessRole =
  process.env.GATE_ECR_ACCESS_ROLE_ARN ||
  `arn:aws:iam::${account}:role/zexvro-apprunner-ecr-access`
const corsOrigins =
  process.env.GATE_CORS_ORIGINS ||
  [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://console.zexvro.in',
    'https://zexvro.pages.dev',
    'https://main.zexvro.pages.dev',
    'https://*.zexvro.pages.dev',
    'https://zexvro.in',
    'https://www.zexvro.in',
  ].join(',')

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

function resolveSecretArn() {
  try {
    const out = awsJson([
      'secretsmanager',
      'describe-secret',
      '--secret-id',
      'zexvro/agent-auth/issuer-signing',
    ])
    return out.ARN
  } catch {
    return secretArn
  }
}

const sourceConfig = {
  AuthenticationConfiguration: {
    AccessRoleArn: accessRole,
  },
  AutoDeploymentsEnabled: false,
  ImageRepository: {
    ImageIdentifier: image,
    ImageRepositoryType: 'ECR',
    ImageConfiguration: {
      Port: '4103',
      RuntimeEnvironmentVariables: {
        NODE_ENV: 'production',
        AGENT_AUTH_PORT: '4103',
        AGENT_AUTH_ISSUER: issuer,
        GATE_BASE_PATH: '/gate',
        GATE_REQUIRE_POP: 'true',
        GATE_STATE_BACKEND: 'dynamo',
        GATE_DYNAMO_TABLE: 'zexvro-agent-auth',
        GATE_ALLOW_DEV_HUMAN: 'false',
        GATE_ALLOW_DEV_HMAC: 'false',
        GATE_ADMIN_REQUIRE_AUTH: 'true',
        GATE_CORS_ORIGINS: corsOrigins,
        AWS_REGION: region,
      },
      RuntimeEnvironmentSecrets: {
        AGENT_AUTH_SIGNING_SECRET: resolveSecretArn(),
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
  Path: '/health',
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
    'apprunner',
    'update-service',
    '--service-arn',
    existing.ServiceArn,
    '--source-configuration',
    JSON.stringify(sourceConfig),
    '--instance-configuration',
    JSON.stringify(instanceConfig),
    '--health-check-configuration',
    JSON.stringify(healthCheck),
  ])
  console.log(JSON.stringify({ serviceUrl: out.Service?.ServiceUrl, status: out.Service?.Status }, null, 2))
} else {
  console.log(`Creating App Runner ${serviceName} → ${image}`)
  const out = awsJson([
    'apprunner',
    'create-service',
    '--service-name',
    serviceName,
    '--source-configuration',
    JSON.stringify(sourceConfig),
    '--instance-configuration',
    JSON.stringify(instanceConfig),
    '--health-check-configuration',
    JSON.stringify(healthCheck),
  ])
  console.log(
    JSON.stringify(
      {
        serviceArn: out.Service?.ServiceArn,
        serviceUrl: out.Service?.ServiceUrl,
        status: out.Service?.Status,
      },
      null,
      2,
    ),
  )
}

console.log(`
Next:
  1. Wait until Status=RUNNING
  2. curl https://<ServiceUrl>/health
  3. curl https://<ServiceUrl>/gate/health
  4. Cloudflare DNS: CNAME api → <ServiceUrl> (proxied or DNS-only)
  5. Public: https://api.zexvro.in/gate/health
`)
