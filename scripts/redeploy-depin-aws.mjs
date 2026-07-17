#!/usr/bin/env node
/**
 * Redeploy only the De-pin App Runner service with current CORS-hardened source.
 * Uses CodeBuild → ECR → App Runner (no local Docker socket required).
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  cpSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const region = process.env.AWS_REGION || 'us-east-1';
const account = process.env.AWS_ACCOUNT_ID || '290294660486';
const ecrBase = `${account}.dkr.ecr.${region}.amazonaws.com`;
const depinImage = `${ecrBase}/zexvro-depin`;
const tag = process.env.IMAGE_TAG || `depin-${Date.now()}`;
const workDir = path.join('/tmp/opencode', 'zexvro-depin-redeploy');
const sourceBucket = process.env.DEPLOY_SOURCE_BUCKET || `zexvro-deploy-${account}-${region}`;
const codebuildProject = 'zexvro-nft-depin-build';
const serviceArn =
  process.env.DEPIN_SERVICE_ARN ||
  'arn:aws:apprunner:us-east-1:290294660486:service/zexvro-depin/305f91bceef64c699af3dcaaf34db628';
const accessRoleArn = `arn:aws:iam::${account}:role/zexvro-apprunner-ecr-access`;
const instanceRoleArn = `arn:aws:iam::${account}:role/zexvro-apprunner-instance`;
const codebuildRoleArn = `arn:aws:iam::${account}:role/zexvro-codebuild-ecr`;

const corsOrigins = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://zexvrodashboard.xyz',
  'https://www.zexvrodashboard.xyz',
  'https://zexvro.pages.dev',
].join(',');

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
    cwd: opts.cwd || root,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    if (opts.capture) {
      console.error(result.stdout || '');
      console.error(result.stderr || '');
    }
    throw new Error(`${cmd} failed with status ${String(result.status)}`);
  }
  return opts.capture ? (result.stdout || '').trim() : '';
}

function awsJson(args) {
  const out = run('aws', [...args, '--region', region, '--output', 'json'], {
    capture: true,
  });
  return out ? JSON.parse(out) : null;
}

function waitService(arn, label) {
  for (let i = 0; i < 80; i += 1) {
    const desc = awsJson(['apprunner', 'describe-service', '--service-arn', arn]);
    const status = desc.Service.Status;
    console.log(`[apprunner] ${label} status=${status}`);
    if (status === 'RUNNING') return desc.Service;
    if (['CREATE_FAILED', 'DELETE_FAILED', 'UPDATE_FAILED'].includes(status)) {
      throw new Error(`${label} entered ${status}`);
    }
    spawnSync('sleep', ['15']);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

mkdirSync(workDir, { recursive: true });
const stageDir = path.join(workDir, 'source');
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(path.join(stageDir, 'depin'), { recursive: true });

for (const name of [
  'Dockerfile',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.build.json',
  'src',
]) {
  const from = path.join(root, 'services/depin', name);
  if (!existsSync(from)) throw new Error(`Missing ${from}`);
  cpSync(from, path.join(stageDir, 'depin', name), { recursive: true });
}

writeFileSync(
  path.join(stageDir, 'buildspec.yml'),
  `version: 0.2
phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_BASE
  build:
    commands:
      - docker build -t $DEPIN_IMAGE:$IMAGE_TAG -t $DEPIN_IMAGE:latest ./depin
  post_build:
    commands:
      - docker push $DEPIN_IMAGE:$IMAGE_TAG
      - docker push $DEPIN_IMAGE:latest
artifacts:
  files:
    - '**/*'
`,
);

// CodeBuild S3 source must be a ZIP (not tar.gz) for reliable extraction.
const sourceKey = `builds/depin-only-${tag}.zip`;
const zipFile = path.join(workDir, 'source.zip');
const zipScript = path.join(workDir, 'make-zip.py');
writeFileSync(
  zipScript,
  [
    'import os, zipfile',
    `root = ${JSON.stringify(stageDir)}`,
    `out = ${JSON.stringify(zipFile)}`,
    'with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:',
    '    for dirpath, _, files in os.walk(root):',
    '        for name in files:',
    '            full = os.path.join(dirpath, name)',
    '            z.write(full, os.path.relpath(full, root))',
    '',
  ].join('\n'),
);
run('python3', [zipScript]);
run('aws', ['s3', 'cp', zipFile, `s3://${sourceBucket}/${sourceKey}`, '--region', region]);

const projectConfig = {
  name: codebuildProject,
  description: 'Build and push ZEXVRO De-pin image only',
  source: { type: 'S3', location: `${sourceBucket}/${sourceKey}` },
  artifacts: { type: 'NO_ARTIFACTS' },
  environment: {
    type: 'LINUX_CONTAINER',
    image: 'aws/codebuild/standard:7.0',
    computeType: 'BUILD_GENERAL1_SMALL',
    privilegedMode: true,
    environmentVariables: [
      { name: 'AWS_DEFAULT_REGION', value: region },
      { name: 'ECR_BASE', value: ecrBase },
      { name: 'DEPIN_IMAGE', value: depinImage },
      { name: 'IMAGE_TAG', value: tag },
    ],
  },
  serviceRole: codebuildRoleArn,
};

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
  codebuildRoleArn,
]);
console.log(`[codebuild] updated ${codebuildProject} for depin-only source`);

const start = awsJson([
  'codebuild',
  'start-build',
  '--project-name',
  codebuildProject,
  '--environment-variables-override',
  JSON.stringify([
    { name: 'IMAGE_TAG', value: tag, type: 'PLAINTEXT' },
    { name: 'DEPIN_IMAGE', value: depinImage, type: 'PLAINTEXT' },
    { name: 'ECR_BASE', value: ecrBase, type: 'PLAINTEXT' },
  ]),
]);
const buildId = start.build.id;
console.log(`[codebuild] started ${buildId}`);

let buildStatus = 'IN_PROGRESS';
for (let i = 0; i < 80; i += 1) {
  const builds = awsJson(['codebuild', 'batch-get-builds', '--ids', buildId]);
  const b = builds.builds[0];
  buildStatus = b.buildStatus;
  console.log(`[codebuild] status=${buildStatus} phase=${b.currentPhase}`);
  if (buildStatus === 'SUCCEEDED') break;
  if (['FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT'].includes(buildStatus)) {
    throw new Error(`CodeBuild failed: ${buildStatus}`);
  }
  spawnSync('sleep', ['20']);
}
if (buildStatus !== 'SUCCEEDED') throw new Error('CodeBuild timed out');

const depinImageId = `${depinImage}:${tag}`;
const depinSecretArn = awsJson([
  'secretsmanager',
  'describe-secret',
  '--secret-id',
  'zexvro/depin/config-json',
]).ARN;

// Wait until RUNNING before update
waitService(serviceArn, 'zexvro-depin');

console.log(`[apprunner] updating zexvro-depin → ${depinImageId}`);
awsJson([
  'apprunner',
  'update-service',
  '--service-arn',
  serviceArn,
  '--source-configuration',
  JSON.stringify({
    AuthenticationConfiguration: { AccessRoleArn: accessRoleArn },
    AutoDeploymentsEnabled: false,
    ImageRepository: {
      ImageIdentifier: depinImageId,
      ImageRepositoryType: 'ECR',
      ImageConfiguration: {
        Port: '4102',
        RuntimeEnvironmentVariables: {
          NODE_ENV: 'production',
          PORT: '4102',
          DEPIN_STATE_BACKEND: 'file',
          DEPIN_STATE_PATH: '/tmp/depin-state.json',
          CORS_ALLOWED_ORIGINS: corsOrigins,
        },
        RuntimeEnvironmentSecrets: {
          DEPIN_CONFIG_JSON: depinSecretArn,
        },
      },
    },
  }),
  '--instance-configuration',
  JSON.stringify({
    Cpu: '0.25 vCPU',
    Memory: '0.5 GB',
    InstanceRoleArn: instanceRoleArn,
  }),
]);

const ready = waitService(serviceArn, 'zexvro-depin');
const depinUrl = `https://${ready.ServiceUrl}`;
console.log(`[done] De-pin ${depinUrl} image=${depinImageId}`);
console.log(`[verify] curl -sI -X OPTIONS ${depinUrl}/status -H 'Origin: http://localhost:3000'`);
