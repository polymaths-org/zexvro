import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDirectory = path.join(rootDirectory, 'frontend');
const nftApiDirectory = path.join(rootDirectory, 'services/nft-service/api');
const depinDirectory = path.join(rootDirectory, 'services/depin');
const agentAuthDirectory = path.join(rootDirectory, 'services/agent-auth');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const defaultWasmHash = 'df42dfceaf2036be527561f313392cee4b756d34745d7cc5f7a1c96936543710';

const args = new Set(process.argv.slice(2));
const onlyArg = [...args].find((arg) => arg.startsWith('--only='));
const only = onlyArg?.slice('--only='.length);
const withDepin = args.has('--with-depin') || only === 'depin';
const withAgentAuth = args.has('--with-agent-auth') || only === 'agent-auth';
const withNft = !(args.has('--no-nft') || args.has('--skip-nft'));

if (only !== undefined && !['frontend', 'nft', 'depin', 'agent-auth'].includes(only)) {
  console.error(`Unsupported --only target: ${only}`);
  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function stellarCli(args) {
  const result = spawnSync('stellar', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) return undefined;
  const output = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  return output || undefined;
}

function withDefaults(env) {
  const next = { ...env };
  next.APP_URL ||= 'http://127.0.0.1:3000';
  next.VITE_NFT_API_URL ||= '/api/nft';
  next.NFT_API_PROXY_TARGET ||= 'http://127.0.0.1:4101';
  next.VITE_DEPIN_API_URL ||= '/api/depin';
  next.DEPIN_API_PROXY_TARGET ||= 'http://127.0.0.1:4102';
  next.VITE_AGENT_AUTH_API_URL ||= '/api/agent-auth';
  next.AGENT_AUTH_API_PROXY_TARGET ||= 'http://127.0.0.1:4103';
  next.PORT ||= '4101';
  next.NFT_STORAGE_MODE ||= 'local';
  next.NFT_PUBLIC_BASE_URL ||= 'http://127.0.0.1:4101';
  next.NFT_COLLECTION_WASM_HASH ||= defaultWasmHash;
  next.ZEXVRO_STELLAR_IDENTITY ||= 'zexvro-provider';

  if (!next.STELLAR_SPONSOR_SECRET) {
    const secret = stellarCli(['keys', 'secret', next.ZEXVRO_STELLAR_IDENTITY]);
    if (secret) {
      next.STELLAR_SPONSOR_SECRET = secret;
    } else {
      console.warn(
        `Could not read Stellar CLI identity "${next.ZEXVRO_STELLAR_IDENTITY}". NFT chain operations will return stellar_not_configured.`,
      );
    }
  }

  if (!next.VITE_STELLAR_OWNER_ADDRESS) {
    const address = stellarCli(['keys', 'address', next.ZEXVRO_STELLAR_IDENTITY]);
    if (address) next.VITE_STELLAR_OWNER_ADDRESS = address;
  }

  return next;
}

const fileEnv = {
  ...parseEnvFile(path.join(rootDirectory, '.env')),
  ...parseEnvFile(path.join(rootDirectory, '.env.local')),
};
const baseEnv = withDefaults({
  ...fileEnv,
  ...process.env,
});

const children = [];
let stopping = false;

function prefixOutput(child, label) {
  const prefix = `[${label}] `;
  child.stdout?.on('data', (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line) process.stdout.write(`${prefix}${line}\n`);
    }
  });
  child.stderr?.on('data', (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line) process.stderr.write(`${prefix}${line}\n`);
    }
  });
}

function start(label, cwd, commandArgs, extraEnv = {}) {
  const child = spawn(npmCommand, commandArgs, {
    cwd,
    env: { ...baseEnv, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  prefixOutput(child, label);
  child.once('error', (error) => {
    console.error(`[${label}] failed: ${error.message}`);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[${label}] exited (${signal || String(code)}).`);
      stop(code ?? 1);
    }
  });
  return child;
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  }
}

const depinConfigPathResolved = (() => {
  const configuredPath = baseEnv.DEPIN_CONFIG_PATH || 'depin.config.json';
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(depinDirectory, configuredPath);
})();
const depinConfigExists = existsSync(depinConfigPathResolved);
// Start De-pin with plain `npm run dev` when a local config exists (same as frontend dev-stack).
// Force on with --with-depin / npm run dev:all; force off is only via --only=frontend|nft.
const shouldStartDepin =
  only === 'depin' ||
  (only === undefined && (withDepin || depinConfigExists));

function shouldStart(target) {
  if (only === undefined) {
    if (target === 'frontend') return true;
    if (target === 'nft') return withNft;
    if (target === 'depin') return shouldStartDepin; // their auto-start when config exists
    if (target === 'agent-auth') return withAgentAuth;
    return false;
  }
  // Allow composing --only=frontend with --with-agent-auth / --with-depin
  if (only === 'frontend') {
    if (target === 'frontend') return true;
    if (target === 'agent-auth') return withAgentAuth;
    if (target === 'depin') return withDepin || shouldStartDepin;
    return false;
  }
  return only === target;
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

if (shouldStart('nft')) {
  start('nft-api', nftApiDirectory, ['run', 'dev']);
}

if (shouldStart('depin')) {
  if (!depinConfigExists) {
    console.warn(
      `[depin] config not found at ${depinConfigPathResolved}. Copy services/depin/depin.config.example.json to depin.config.json first.`,
    );
  } else if (!withDepin && only === undefined) {
    console.log(`[depin] auto-starting (config found at ${depinConfigPathResolved})`);
  }
  start('depin', depinDirectory, ['run', 'dev'], {
    DEPIN_CONFIG_PATH: depinConfigPathResolved,
  });
}

if (shouldStart('agent-auth')) {
  start('agent-auth', agentAuthDirectory, ['run', 'dev'], {
    AGENT_AUTH_PORT: '4103',
  });
}


if (shouldStart('frontend')) {
  start('frontend', frontendDirectory, ['run', 'dev']);
}

if (children.length === 0) {
  console.error('No dev targets selected.');
  process.exit(1);
}

const labels = [];
if (shouldStart('nft')) labels.push('NFT API :' + (baseEnv.PORT || '4101'));
if (shouldStart('depin')) labels.push('De-pin :4102');
if (shouldStart('agent-auth')) labels.push('Gate/Agent-Auth :4103');
if (shouldStart('frontend')) labels.push('Frontend :3000');
console.log(`[zexvro] root env loaded from ${existsSync(path.join(rootDirectory, '.env')) ? '.env' : '.env.example defaults + process env'}`);
console.log(`[zexvro] starting ${labels.join(', ')}`);
if (!baseEnv.STELLAR_SPONSOR_SECRET) {
  console.warn('[zexvro] STELLAR_SPONSOR_SECRET is empty and Stellar CLI identity was not loaded.');
} else {
  console.log(`[zexvro] Stellar sponsor identity ready (${baseEnv.ZEXVRO_STELLAR_IDENTITY || 'configured'})`);
}

