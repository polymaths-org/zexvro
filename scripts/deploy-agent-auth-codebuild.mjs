#!/usr/bin/env node
/**
 * Deploy ZEXVRO Gate (agent-auth) via CodeBuild → ECR → App Runner.
 * No local Docker socket required.
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  cpSync,
  rmSync,
  createWriteStream,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { execSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const region = process.env.AWS_REGION || 'us-east-1'
const account = process.env.AWS_ACCOUNT_ID || '290294660486'
const ecrBase = `${account}.dkr.ecr.${region}.amazonaws.com`
const gateImage = `${ecrBase}/zexvro-agent-auth`
const tag = process.env.IMAGE_TAG || `gate-${Date.now()}`
const workDir = path.join('/tmp', 'zexvro-gate-deploy')
const sourceBucket = process.env.DEPLOY_SOURCE_BUCKET || `zexvro-deploy-${account}-${region}`
const codebuildProject = process.env.GATE_CODEBUILD_PROJECT || 'zexvro-agent-auth-build'
const serviceName = 'zexvro-agent-auth'
const tableName = process.env.GATE_DYNAMO_TABLE || 'zexvro-agent-auth'
const secretName = process.env.GATE_SIGNING_SECRET_NAME || 'zexvro/agent-auth/issuer-signing'
const instanceRole = `arn:aws:iam::${account}:role/zexvro-gate-apprunner-instance`
const ecrAccessRole = `arn:aws:iam::${account}:role/zexvro-gate-apprunner-ecr-access`
const codebuildRole = `arn:aws:iam::${account}:role/zexvro-codebuild-ecr`

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`)
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
    cwd: opts.cwd || root,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (result.status !== 0) {
    if (opts.capture) {
      console.error(result.stdout || '')
      console.error(result.stderr || '')
    }
    throw new Error(`${cmd} failed with status ${String(result.status)}`)
  }
  return opts.capture ? (result.stdout || '').trim() : ''
}

function awsJson(args) {
  const out = run('aws', [...args, '--region', region, '--output', 'json'], { capture: true })
  return out ? JSON.parse(out) : null
}

async function tarGzipDir(srcDir, outFile) {
  // Use system tar for reliability
  execSync(`tar -czf ${JSON.stringify(outFile)} -C ${JSON.stringify(srcDir)} .`, {
    stdio: 'inherit',
  })
}

function ensureSecretArn() {
  const list = awsJson(['secretsmanager', 'describe-secret', '--secret-id', secretName])
  return list.ARN
}

// --- ensure ECR ---
try {
  awsJson(['ecr', 'describe-repositories', '--repository-names', 'zexvro-agent-auth'])
  console.log('[ecr] zexvro-agent-auth exists')
} catch {
  awsJson([
    'ecr',
    'create-repository',
    '--repository-name',
    'zexvro-agent-auth',
    '--image-scanning-configuration',
    'scanOnPush=true',
  ])
  console.log('[ecr] created zexvro-agent-auth')
}

// --- stage source ---
rmSync(workDir, { recursive: true, force: true })
const stageDir = path.join(workDir, 'stage')
mkdirSync(path.join(stageDir, 'agent-auth'), { recursive: true })

function copyService(src, dest) {
  for (const name of [
    'Dockerfile',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.build.json',
    'src',
  ]) {
    const from = path.join(src, name)
    if (!existsSync(from)) throw new Error(`Missing ${from}`)
    cpSync(from, path.join(dest, name), { recursive: true })
  }
}
copyService(path.join(root, 'services/agent-auth'), path.join(stageDir, 'agent-auth'))

writeFileSync(
  path.join(stageDir, 'buildspec.yml'),
  `version: 0.2
phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_BASE
  build:
    commands:
      - echo Building Gate image $GATE_IMAGE:$IMAGE_TAG
      - docker build -t $GATE_IMAGE:$IMAGE_TAG -t $GATE_IMAGE:latest ./agent-auth
  post_build:
    commands:
      - docker push $GATE_IMAGE:$IMAGE_TAG
      - docker push $GATE_IMAGE:latest
      - printf '[{"name":"gate","imageUri":"%s"}]' $GATE_IMAGE:$IMAGE_TAG > imagedefinitions.json
artifacts:
  files:
    - imagedefinitions.json
`,
)

const sourceKey = `builds/agent-auth-${tag}.tar.gz`
const tarball = path.join(workDir, 'source.tar.gz')
await tarGzipDir(stageDir, tarball)

// ensure bucket
try {
  run('aws', ['s3api', 'head-bucket', '--bucket', sourceBucket, '--region', region], {
    capture: true,
  })
} catch {
  run('aws', [
    's3api',
    'create-bucket',
    '--bucket',
    sourceBucket,
    '--region',
    region,
    ...(region === 'us-east-1' ? [] : ['--create-bucket-configuration', `LocationConstraint=${region}`]),
  ])
}
run('aws', ['s3', 'cp', tarball, `s3://${sourceBucket}/${sourceKey}`, '--region', region])

// CodeBuild project
const projectConfig = {
  name: codebuildProject,
  description: 'Build and push ZEXVRO Gate (agent-auth) image to ECR',
  source: { type: 'S3', location: `${sourceBucket}/${sourceKey}` },
  artifacts: { type: 'NO_ARTIFACTS' },
  environment: {
    type: 'LINUX_CONTAINER',
    image: 'aws/codebuild/standard:7.0',
    computeType: 'BUILD_GENERAL1_SMALL',
    privilegedMode: true,
    environmentVariables: [
      { name: 'AWS_DEFAULT_REGION', value: region },
      { name: 'AWS_ACCOUNT_ID', value: account },
      { name: 'ECR_BASE', value: ecrBase },
      { name: 'GATE_IMAGE', value: gateImage },
      { name: 'IMAGE_TAG', value: tag },
    ],
  },
  serviceRole: codebuildRole,
}

try {
  awsJson(['codebuild', 'batch-get-projects', '--names', codebuildProject])
  const existing = awsJson(['codebuild', 'batch-get-projects', '--names', codebuildProject])
  if (existing.projects?.length && existing.projects[0]?.name) {
    awsJson([
      'codebuild',
      'update-project',
      '--name',
      codebuildProject,
      '--source',
      JSON.stringify(projectConfig.source),
      '--environment',
      JSON.stringify(projectConfig.environment),
      '--service-role',
      codebuildRole,
    ])
    console.log(`[codebuild] updated ${codebuildProject}`)
  } else {
    throw new Error('missing')
  }
} catch {
  awsJson([
    'codebuild',
    'create-project',
    '--cli-input-json',
    JSON.stringify({
      name: projectConfig.name,
      description: projectConfig.description,
      source: projectConfig.source,
      artifacts: projectConfig.artifacts,
      environment: projectConfig.environment,
      serviceRole: projectConfig.serviceRole,
    }),
  ])
  console.log(`[codebuild] created ${codebuildProject}`)
}

const start = awsJson([
  'codebuild',
  'start-build',
  '--project-name',
  codebuildProject,
  '--source-location-override',
  `${sourceBucket}/${sourceKey}`,
  '--environment-variables-override',
  JSON.stringify([
    { name: 'IMAGE_TAG', value: tag, type: 'PLAINTEXT' },
    { name: 'GATE_IMAGE', value: gateImage, type: 'PLAINTEXT' },
    { name: 'ECR_BASE', value: ecrBase, type: 'PLAINTEXT' },
  ]),
])
const buildId = start.build.id
console.log(`[codebuild] started ${buildId}`)

let buildStatus = 'IN_PROGRESS'
for (let i = 0; i < 90; i += 1) {
  const builds = awsJson(['codebuild', 'batch-get-builds', '--ids', buildId])
  const b = builds.builds[0]
  buildStatus = b.buildStatus
  console.log(`[codebuild] status=${buildStatus} phase=${b.currentPhase}`)
  if (buildStatus === 'SUCCEEDED') break
  if (['FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT'].includes(buildStatus)) {
    throw new Error(`CodeBuild failed: ${buildStatus}`)
  }
  spawnSync('sleep', ['15'])
}
if (buildStatus !== 'SUCCEEDED') throw new Error('CodeBuild timed out')

const imageId = `${gateImage}:${tag}`
console.log(`[ecr] image ready ${imageId}`)

// Ensure secret ARN
const secretArn = ensureSecretArn()
console.log(`[secret] ${secretArn}`)

// Create or update App Runner
const envVars = [
  { Name: 'NODE_ENV', Value: 'production' },
  { Name: 'AGENT_AUTH_PORT', Value: '4103' },
  { Name: 'GATE_REQUIRE_POP', Value: 'true' },
  { Name: 'GATE_STATE_BACKEND', Value: 'dynamo' },
  { Name: 'GATE_DYNAMO_TABLE', Value: tableName },
  { Name: 'GATE_ADMIN_REQUIRE_AUTH', Value: 'true' },
  { Name: 'COGNITO_USER_POOL_ID', Value: process.env.COGNITO_USER_POOL_ID || 'us-east-1_vyONcitBD' },
  { Name: 'COGNITO_CLIENT_ID', Value: process.env.COGNITO_CLIENT_ID || '7qmkq33si9qk8pgo6ebi3qantm' },
  { Name: 'AWS_REGION', Value: region },
]

const imageConfig = {
  ImageIdentifier: imageId,
  ImageRepositoryType: 'ECR',
  ImageConfiguration: {
    Port: '4103',
    RuntimeEnvironmentVariables: Object.fromEntries(envVars.map((e) => [e.Name, e.Value])),
    RuntimeEnvironmentSecrets: {
      AGENT_AUTH_SIGNING_SECRET: secretArn,
    },
  },
}

let serviceArn
let serviceUrl
try {
  const listed = awsJson(['apprunner', 'list-services'])
  const existing = (listed.ServiceSummaryList || []).find((s) => s.ServiceName === serviceName)
  if (existing) {
    serviceArn = existing.ServiceArn
    const updated = awsJson([
      'apprunner',
      'update-service',
      '--service-arn',
      serviceArn,
      '--source-configuration',
      JSON.stringify({
        AuthenticationConfiguration: { AccessRoleArn: ecrAccessRole },
        AutoDeploymentsEnabled: false,
        ImageRepository: {
          ImageIdentifier: imageId,
          ImageRepositoryType: 'ECR',
          ImageConfiguration: {
            Port: '4103',
            RuntimeEnvironmentVariables: Object.fromEntries(
              envVars.map((e) => [e.Name, e.Value]),
            ),
            RuntimeEnvironmentSecrets: {
              AGENT_AUTH_SIGNING_SECRET: secretArn,
            },
          },
        },
      }),
      '--instance-configuration',
      JSON.stringify({
        Cpu: '256',
        Memory: '512',
        InstanceRoleArn: instanceRole,
      }),
    ])
    serviceUrl = updated.Service.ServiceUrl
    console.log(`[apprunner] updated ${serviceName}`)
  } else {
    throw new Error('not found')
  }
} catch {
  const created = awsJson([
    'apprunner',
    'create-service',
    '--service-name',
    serviceName,
    '--source-configuration',
    JSON.stringify({
      AuthenticationConfiguration: { AccessRoleArn: ecrAccessRole },
      AutoDeploymentsEnabled: false,
      ImageRepository: {
        ImageIdentifier: imageId,
        ImageRepositoryType: 'ECR',
        ImageConfiguration: {
          Port: '4103',
          RuntimeEnvironmentVariables: Object.fromEntries(envVars.map((e) => [e.Name, e.Value])),
          RuntimeEnvironmentSecrets: {
            AGENT_AUTH_SIGNING_SECRET: secretArn,
          },
        },
      },
    }),
    '--instance-configuration',
    JSON.stringify({
      Cpu: '256',
      Memory: '512',
      InstanceRoleArn: instanceRole,
    }),
    '--health-check-configuration',
    JSON.stringify({
      Protocol: 'HTTP',
      Path: '/health',
      Interval: 10,
      Timeout: 5,
      HealthyThreshold: 1,
      UnhealthyThreshold: 5,
    }),
  ])
  serviceArn = created.Service.ServiceArn
  serviceUrl = created.Service.ServiceUrl
  console.log(`[apprunner] created ${serviceName}`)
}

// Wait for RUNNING
for (let i = 0; i < 60; i += 1) {
  const desc = awsJson(['apprunner', 'describe-service', '--service-arn', serviceArn])
  const status = desc.Service.Status
  serviceUrl = desc.Service.ServiceUrl
  console.log(`[apprunner] status=${status} url=${serviceUrl}`)
  if (status === 'RUNNING') break
  if (['CREATE_FAILED', 'DELETE_FAILED', 'UPDATE_FAILED'].includes(status)) {
    throw new Error(`App Runner failed: ${status}`)
  }
  spawnSync('sleep', ['15'])
}

// Set issuer to public URL
if (serviceUrl) {
  const issuer = `https://${serviceUrl}`
  awsJson([
    'apprunner',
    'update-service',
    '--service-arn',
    serviceArn,
    '--source-configuration',
    JSON.stringify({
      AuthenticationConfiguration: { AccessRoleArn: ecrAccessRole },
      AutoDeploymentsEnabled: false,
      ImageRepository: {
        ImageIdentifier: imageId,
        ImageRepositoryType: 'ECR',
        ImageConfiguration: {
          Port: '4103',
          RuntimeEnvironmentVariables: {
            ...Object.fromEntries(envVars.map((e) => [e.Name, e.Value])),
            AGENT_AUTH_ISSUER: issuer,
          },
          RuntimeEnvironmentSecrets: {
            AGENT_AUTH_SIGNING_SECRET: secretArn,
          },
        },
      },
    }),
  ])
  console.log(`[apprunner] set AGENT_AUTH_ISSUER=${issuer}`)
}

console.log(
  JSON.stringify(
    {
      imageId,
      serviceArn,
      serviceUrl: serviceUrl ? `https://${serviceUrl}` : null,
      health: serviceUrl ? `https://${serviceUrl}/health` : null,
    },
    null,
    2,
  ),
)
