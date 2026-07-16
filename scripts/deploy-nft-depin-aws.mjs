#!/usr/bin/env node
/**
 * Deploy NFT API + De-pin gateway to AWS App Runner (us-east-1).
 *
 * Builds container images via CodeBuild (no local Docker socket required),
 * pushes to ECR, then creates/updates App Runner services.
 *
 * Prerequisites: AWS CLI with account access for ECR/App Runner/IAM/CodeBuild/S3.
 * Reuses DynamoDB/S3/CloudFront/Secrets Manager from docs/aws_nft_production.md.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  createWriteStream,
  cpSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const region = process.env.AWS_REGION || 'us-east-1';
const account = process.env.AWS_ACCOUNT_ID || '290294660486';
const ecrBase = `${account}.dkr.ecr.${region}.amazonaws.com`;
const nftImage = `${ecrBase}/zexvro-nft-api`;
const depinImage = `${ecrBase}/zexvro-depin`;
const tag = process.env.IMAGE_TAG || `deploy-${Date.now()}`;
const workDir = path.join('/tmp/opencode', 'zexvro-aws-deploy');
const sourceBucket = process.env.DEPLOY_SOURCE_BUCKET || `zexvro-deploy-${account}-${region}`;
const codebuildProject = 'zexvro-nft-depin-build';

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

function ensureEcrRepo(name) {
  try {
    awsJson(['ecr', 'describe-repositories', '--repository-names', name]);
    console.log(`[ecr] ${name} exists`);
  } catch {
    awsJson([
      'ecr',
      'create-repository',
      '--repository-name',
      name,
      '--image-scanning-configuration',
      'scanOnPush=true',
    ]);
    console.log(`[ecr] created ${name}`);
  }
}

function ensureRole(roleName, trustPolicy, managedPolicies = [], inlinePolicies = {}) {
  try {
    awsJson(['iam', 'get-role', '--role-name', roleName]);
    console.log(`[iam] role ${roleName} exists`);
  } catch {
    run('aws', [
      'iam',
      'create-role',
      '--role-name',
      roleName,
      '--assume-role-policy-document',
      JSON.stringify(trustPolicy),
      '--region',
      region,
    ]);
    console.log(`[iam] created role ${roleName}`);
  }
  for (const arn of managedPolicies) {
    try {
      run('aws', [
        'iam',
        'attach-role-policy',
        '--role-name',
        roleName,
        '--policy-arn',
        arn,
        '--region',
        region,
      ]);
    } catch {
      // already attached
    }
  }
  for (const [name, document] of Object.entries(inlinePolicies)) {
    run('aws', [
      'iam',
      'put-role-policy',
      '--role-name',
      roleName,
      '--policy-name',
      name,
      '--policy-document',
      JSON.stringify(document),
      '--region',
      region,
    ]);
  }
  return `arn:aws:iam::${account}:role/${roleName}`;
}

function ensureBucket(bucket) {
  try {
    run('aws', ['s3api', 'head-bucket', '--bucket', bucket, '--region', region], {
      capture: true,
    });
    console.log(`[s3] bucket ${bucket} exists`);
  } catch {
    if (region === 'us-east-1') {
      run('aws', ['s3api', 'create-bucket', '--bucket', bucket, '--region', region]);
    } else {
      run('aws', [
        's3api',
        'create-bucket',
        '--bucket',
        bucket,
        '--region',
        region,
        '--create-bucket-configuration',
        `LocationConstraint=${region}`,
      ]);
    }
    console.log(`[s3] created ${bucket}`);
  }
}

function tarGzipDir(srcDir, outFile) {
  // Portable: use system tar
  run('tar', ['-czf', outFile, '-C', srcDir, '.']);
}

function getOrCreateAppRunnerService({
  serviceName,
  imageIdentifier,
  port,
  accessRoleArn,
  instanceRoleArn,
  runtimeEnv,
  runtimeSecrets,
}) {
  const list = awsJson(['apprunner', 'list-services']);
  const existing = (list.ServiceSummaryList || []).find(
    (s) => s.ServiceName === serviceName,
  );

  const sourceConfiguration = {
    AuthenticationConfiguration: {
      AccessRoleArn: accessRoleArn,
    },
    AutoDeploymentsEnabled: false,
    ImageRepository: {
      ImageIdentifier: imageIdentifier,
      ImageRepositoryType: 'ECR',
      ImageConfiguration: {
        Port: String(port),
        RuntimeEnvironmentVariables: runtimeEnv,
        RuntimeEnvironmentSecrets: runtimeSecrets,
      },
    },
  };

  const instanceConfiguration = {
    Cpu: '0.25 vCPU',
    Memory: '0.5 GB',
    InstanceRoleArn: instanceRoleArn,
  };

  if (existing) {
    console.log(`[apprunner] updating ${serviceName}`);
    // Wait if service is not in a terminal-ready state for update
    let arn = existing.ServiceArn;
    for (let i = 0; i < 40; i += 1) {
      const desc = awsJson(['apprunner', 'describe-service', '--service-arn', arn]);
      const status = desc.Service.Status;
      if (['RUNNING', 'CREATE_FAILED', 'UPDATE_FAILED', 'PAUSED'].includes(status)) break;
      console.log(`[apprunner] waiting to update ${serviceName} (status=${status})`);
      spawnSync('sleep', ['10']);
    }
    const updated = awsJson([
      'apprunner',
      'update-service',
      '--service-arn',
      arn,
      '--source-configuration',
      JSON.stringify(sourceConfiguration),
      '--instance-configuration',
      JSON.stringify(instanceConfiguration),
    ]);
    return updated.Service;
  }

  console.log(`[apprunner] creating ${serviceName}`);
  const created = awsJson([
    'apprunner',
    'create-service',
    '--service-name',
    serviceName,
    '--source-configuration',
    JSON.stringify(sourceConfiguration),
    '--instance-configuration',
    JSON.stringify(instanceConfiguration),
    '--health-check-configuration',
    JSON.stringify({
      Protocol: 'HTTP',
      Path: '/health',
      Interval: 10,
      Timeout: 5,
      HealthyThreshold: 1,
      UnhealthyThreshold: 5,
    }),
  ]);
  return created.Service;
}

function waitService(serviceArn, label) {
  for (let i = 0; i < 80; i += 1) {
    const desc = awsJson(['apprunner', 'describe-service', '--service-arn', serviceArn]);
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

const ecrAccessTrust = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'build.apprunner.amazonaws.com' },
      Action: 'sts:AssumeRole',
    },
  ],
};

const instanceTrust = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'tasks.apprunner.amazonaws.com' },
      Action: 'sts:AssumeRole',
    },
  ],
};

const codebuildTrust = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { Service: 'codebuild.amazonaws.com' },
      Action: 'sts:AssumeRole',
    },
  ],
};

const accessRoleArn = ensureRole('zexvro-apprunner-ecr-access', ecrAccessTrust, [
  'arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess',
]);

const instanceRoleArn = ensureRole(
  'zexvro-apprunner-instance',
  instanceTrust,
  [],
  {
    NftAndSecrets: {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'DynamoNft',
          Effect: 'Allow',
          Action: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:DescribeTable',
            'dynamodb:ConditionCheckItem',
          ],
          Resource: [
            `arn:aws:dynamodb:${region}:${account}:table/zexvro-nft`,
            `arn:aws:dynamodb:${region}:${account}:table/zexvro-nft/index/*`,
          ],
        },
        {
          Sid: 'S3NftMedia',
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
          Resource: [
            'arn:aws:s3:::zexvro-nft-media-290294660486-us-east-1',
            'arn:aws:s3:::zexvro-nft-media-290294660486-us-east-1/*',
          ],
        },
        {
          Sid: 'Secrets',
          Effect: 'Allow',
          Action: ['secretsmanager:GetSecretValue'],
          Resource: [
            `arn:aws:secretsmanager:${region}:${account}:secret:zexvro/nft/sponsor-secret*`,
            `arn:aws:secretsmanager:${region}:${account}:secret:zexvro/depin/*`,
          ],
        },
      ],
    },
  },
);

const codebuildRoleArn = ensureRole(
  'zexvro-codebuild-ecr',
  codebuildTrust,
  [],
  {
    BuildPush: {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          Resource: '*',
        },
        {
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject', 's3:ListBucket'],
          Resource: [
            `arn:aws:s3:::${sourceBucket}`,
            `arn:aws:s3:::${sourceBucket}/*`,
          ],
        },
        {
          Effect: 'Allow',
          Action: [
            'ecr:GetAuthorizationToken',
            'ecr:BatchCheckLayerAvailability',
            'ecr:GetDownloadUrlForLayer',
            'ecr:BatchGetImage',
            'ecr:PutImage',
            'ecr:InitiateLayerUpload',
            'ecr:UploadLayerPart',
            'ecr:CompleteLayerUpload',
          ],
          Resource: '*',
        },
      ],
    },
  },
);

console.log('[iam] waiting for role propagation...');
spawnSync('sleep', ['15']);

ensureEcrRepo('zexvro-nft-api');
ensureEcrRepo('zexvro-depin');
ensureBucket(sourceBucket);

// Stage source bundle for CodeBuild
const stageDir = path.join(workDir, 'source');
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(path.join(stageDir, 'nft-api'), { recursive: true });
mkdirSync(path.join(stageDir, 'depin'), { recursive: true });

function copyService(src, dest) {
  for (const name of [
    'Dockerfile',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.build.json',
    'src',
  ]) {
    const from = path.join(src, name);
    if (!existsSync(from)) throw new Error(`Missing ${from}`);
    cpSync(from, path.join(dest, name), { recursive: true });
  }
}

copyService(path.join(root, 'services/nft-service/api'), path.join(stageDir, 'nft-api'));
copyService(path.join(root, 'services/depin'), path.join(stageDir, 'depin'));

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
      - echo Building NFT API image $NFT_IMAGE:$IMAGE_TAG
      - docker build -t $NFT_IMAGE:$IMAGE_TAG -t $NFT_IMAGE:latest ./nft-api
      - echo Building De-pin image $DEPIN_IMAGE:$IMAGE_TAG
      - docker build -t $DEPIN_IMAGE:$IMAGE_TAG -t $DEPIN_IMAGE:latest ./depin
  post_build:
    commands:
      - docker push $NFT_IMAGE:$IMAGE_TAG
      - docker push $NFT_IMAGE:latest
      - docker push $DEPIN_IMAGE:$IMAGE_TAG
      - docker push $DEPIN_IMAGE:latest
      - printf '[{"name":"nft","imageUri":"%s"},{"name":"depin","imageUri":"%s"}]' $NFT_IMAGE:$IMAGE_TAG $DEPIN_IMAGE:$IMAGE_TAG > imagedefinitions.json
artifacts:
  files:
    - imagedefinitions.json
`,
);

const sourceKey = `builds/nft-depin-${tag}.tar.gz`;
const tarball = path.join(workDir, 'source.tar.gz');
tarGzipDir(stageDir, tarball);
run('aws', ['s3', 'cp', tarball, `s3://${sourceBucket}/${sourceKey}`, '--region', region]);

// Ensure CodeBuild project
const projectConfig = {
  name: codebuildProject,
  description: 'Build and push ZEXVRO NFT + De-pin images to ECR',
  source: {
    type: 'S3',
    location: `${sourceBucket}/${sourceKey}`,
  },
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
      { name: 'NFT_IMAGE', value: nftImage },
      { name: 'DEPIN_IMAGE', value: depinImage },
      { name: 'IMAGE_TAG', value: tag },
    ],
  },
  serviceRole: codebuildRoleArn,
};

try {
  awsJson(['codebuild', 'batch-get-projects', '--names', codebuildProject]);
  // update source location each run
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
  console.log(`[codebuild] updated project ${codebuildProject}`);
} catch {
  awsJson([
    'codebuild',
    'create-project',
    '--name',
    codebuildProject,
    '--description',
    projectConfig.description,
    '--source',
    JSON.stringify(projectConfig.source),
    '--artifacts',
    JSON.stringify(projectConfig.artifacts),
    '--environment',
    JSON.stringify(projectConfig.environment),
    '--service-role',
    codebuildRoleArn,
  ]);
  console.log(`[codebuild] created project ${codebuildProject}`);
}

const start = awsJson([
  'codebuild',
  'start-build',
  '--project-name',
  codebuildProject,
  '--environment-variables-override',
  JSON.stringify([
    { name: 'IMAGE_TAG', value: tag, type: 'PLAINTEXT' },
    { name: 'NFT_IMAGE', value: nftImage, type: 'PLAINTEXT' },
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

const nftImageId = `${nftImage}:${tag}`;
const depinImageId = `${depinImage}:${tag}`;

// De-pin provider config stored as Secrets Manager JSON string secret
const depinConfig = {
  port: 4102,
  facilitatorUrl: 'https://x402.org/facilitator',
  maxUpstreamResponseBytes: 10485760,
  replayTtlMs: 600000,
  unpaidRateLimit: { maxRequests: 30, windowMs: 60000 },
  providers: [
    {
      route: '/v1/weather',
      method: 'GET',
      upstreamUrl: 'https://httpbin.org/get',
      description: 'Sample paid weather probe (httpbin)',
      price: '$0.001',
      recipient: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      network: 'stellar:testnet',
      timeoutMs: 5000,
    },
  ],
};

const depinSecretName = 'zexvro/depin/config-json';
try {
  awsJson(['secretsmanager', 'describe-secret', '--secret-id', depinSecretName]);
  run('aws', [
    'secretsmanager',
    'put-secret-value',
    '--secret-id',
    depinSecretName,
    '--secret-string',
    JSON.stringify(depinConfig),
    '--region',
    region,
  ]);
} catch {
  awsJson([
    'secretsmanager',
    'create-secret',
    '--name',
    depinSecretName,
    '--secret-string',
    JSON.stringify(depinConfig),
  ]);
}
const depinSecretArn = awsJson([
  'secretsmanager',
  'describe-secret',
  '--secret-id',
  depinSecretName,
]).ARN;
const sponsorSecretArn = awsJson([
  'secretsmanager',
  'describe-secret',
  '--secret-id',
  'zexvro/nft/sponsor-secret',
]).ARN;

const corsOrigins = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'https://zexvrodashboard.xyz',
  'https://zexvro.pages.dev',
].join(',');

const baseNftEnv = {
  NODE_ENV: 'production',
  PORT: '4101',
  NFT_STORAGE_MODE: 's3',
  NFT_S3_BUCKET: 'zexvro-nft-media-290294660486-us-east-1',
  NFT_S3_REGION: region,
  NFT_CDN_BASE_URL: 'https://d1a0z3arlwwfrj.cloudfront.net',
  NFT_REPOSITORY: 'dynamo',
  NFT_DYNAMO_TABLE: 'zexvro-nft',
  NFT_DYNAMO_REGION: region,
  NFT_DYNAMO_GSI_WORKSPACE: 'workspace-index',
  NFT_DYNAMO_GSI_IDEMPOTENCY: 'idempotency-index',
  NFT_COLLECTION_WASM_HASH:
    'df42dfceaf2036be527561f313392cee4b756d34745d7cc5f7a1c96936543710',
  NFT_REQUIRE_SPONSOR: '1',
  COGNITO_USER_POOL_ID: 'us-east-1_vyONcitBD',
  COGNITO_CLIENT_ID: '7qmkq33si9qk8pgo6ebi3qantm',
  CORS_ALLOWED_ORIGINS: corsOrigins,
  STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org',
  STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  STELLAR_USDC_CONTRACT: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  NFT_PUBLIC_BASE_URL: 'https://placeholder.local',
};

const nftService = getOrCreateAppRunnerService({
  serviceName: 'zexvro-nft-api',
  imageIdentifier: nftImageId,
  port: 4101,
  accessRoleArn,
  instanceRoleArn,
  runtimeEnv: baseNftEnv,
  runtimeSecrets: {
    STELLAR_SPONSOR_SECRET: sponsorSecretArn,
  },
});

const depinService = getOrCreateAppRunnerService({
  serviceName: 'zexvro-depin',
  imageIdentifier: depinImageId,
  port: 4102,
  accessRoleArn,
  instanceRoleArn,
  runtimeEnv: {
    NODE_ENV: 'production',
    PORT: '4102',
    // Multi-instance-safe replay/rate-limit (ephemeral App Runner disk is per instance;
    // still better than process memory when a single task restarts). Prefer redis later.
    DEPIN_STATE_BACKEND: 'file',
    DEPIN_STATE_PATH: '/tmp/depin-state.json',
  },
  runtimeSecrets: {
    DEPIN_CONFIG_JSON: depinSecretArn,
  },
});

const nftReady = waitService(nftService.ServiceArn, 'zexvro-nft-api');
const depinReady = waitService(depinService.ServiceArn, 'zexvro-depin');

const nftUrl = `https://${nftReady.ServiceUrl}`;
const depinUrl = `https://${depinReady.ServiceUrl}`;

console.log(`[apprunner] patching NFT_PUBLIC_BASE_URL=${nftUrl}`);
awsJson([
  'apprunner',
  'update-service',
  '--service-arn',
  nftReady.ServiceArn,
  '--source-configuration',
  JSON.stringify({
    AuthenticationConfiguration: { AccessRoleArn: accessRoleArn },
    AutoDeploymentsEnabled: false,
    ImageRepository: {
      ImageIdentifier: nftImageId,
      ImageRepositoryType: 'ECR',
      ImageConfiguration: {
        Port: '4101',
        RuntimeEnvironmentVariables: {
          ...baseNftEnv,
          NFT_PUBLIC_BASE_URL: nftUrl,
        },
        RuntimeEnvironmentSecrets: {
          STELLAR_SPONSOR_SECRET: sponsorSecretArn,
        },
      },
    },
  }),
]);
waitService(nftReady.ServiceArn, 'zexvro-nft-api');

const summary = {
  region,
  nft: { url: nftUrl, serviceArn: nftReady.ServiceArn, image: nftImageId },
  depin: { url: depinUrl, serviceArn: depinReady.ServiceArn, image: depinImageId },
  frontendEnv: {
    VITE_NFT_API_URL: nftUrl,
    VITE_DEPIN_API_URL: depinUrl,
  },
};
writeFileSync(path.join(workDir, 'deploy-result.json'), JSON.stringify(summary, null, 2));
writeFileSync(
  path.join(root, 'docs/aws_nft_depin_runtime.md'),
  `# NFT + De-pin App Runner runtime

Account \`${account}\`, region \`${region}\`.

| Service | URL |
| --- | --- |
| NFT API | ${nftUrl} |
| De-pin gateway | ${depinUrl} |

## Frontend env (production)

\`\`\`bash
VITE_NFT_API_URL=${nftUrl}
VITE_DEPIN_API_URL=${depinUrl}
\`\`\`

Local dev can keep relative \`/api/nft\` and \`/api/depin\` (Vite proxy).

## Redeploy

\`\`\`bash
node scripts/deploy-nft-depin-aws.mjs
\`\`\`

## Health

\`\`\`bash
curl -s ${nftUrl}/health
curl -s ${depinUrl}/health
curl -s ${depinUrl}/status
\`\`\`

## Storage (already provisioned)

See [aws_nft_production.md](./aws_nft_production.md).
`,
);

// Smoke tests
for (const [name, url] of [
  ['nft', `${nftUrl}/health`],
  ['depin', `${depinUrl}/health`],
]) {
  try {
    const body = run('curl', ['-sS', '--max-time', '20', url], { capture: true });
    console.log(`[smoke] ${name}: ${body}`);
  } catch (error) {
    console.warn(`[smoke] ${name} failed: ${error.message}`);
  }
}

console.log(JSON.stringify(summary, null, 2));
console.log('[done] wrote docs/aws_nft_depin_runtime.md');
