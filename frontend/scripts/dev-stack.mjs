import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDirectory = path.resolve(frontendDirectory, '../services/nft-service/api');
const depinDirectory = path.resolve(frontendDirectory, '../services/depin');
const depinConfigPath = process.env.DEPIN_CONFIG_PATH || path.resolve(depinDirectory, 'depin.config.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const identity = process.env.ZEXVRO_STELLAR_IDENTITY || 'zexvro-provider';
const apiHealthUrl = 'http://127.0.0.1:4101/health';
const depinHealthUrl = 'http://127.0.0.1:4102/health';
const wasmHash = process.env.NFT_COLLECTION_WASM_HASH
  || 'a8a5f637131c4f5db91d682008b68f21ab2f4f87e0844866ac80fad9faab6bad';

const children = [];
let stopping = false;

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  }
}

function track(child, label) {
  children.push(child);
  child.once('error', (error) => {
    console.error(`${label} failed: ${error.message}`);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${label} exited (${signal || String(code)}).`);
      stop(code ?? 1);
    }
  });
  return child;
}

function readSponsorSecret() {
  if (process.env.STELLAR_SPONSOR_SECRET) return process.env.STELLAR_SPONSOR_SECRET;

  const result = spawnSync('stellar', ['keys', 'secret', identity], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const secret = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  if (result.status !== 0 || !secret) {
    const detail = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    throw new Error(
      `Could not read Stellar CLI identity "${identity}".${detail ? ` ${detail}` : ''}`,
    );
  }
  return secret;
}

async function apiIsReady() {
  return healthIsReady(apiHealthUrl);
}

async function depinIsReady() {
  return healthIsReady(depinHealthUrl);
}

async function healthIsReady(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApi(api) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await apiIsReady()) return;
    if (stopping || api.exitCode !== null) throw new Error('NFT API stopped before becoming ready.');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`NFT API did not become ready at ${apiHealthUrl}.`);
}

async function waitForDepin(gateway) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await depinIsReady()) return;
    if (stopping || gateway.exitCode !== null) throw new Error('De-pin gateway stopped before becoming ready.');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`De-pin gateway did not become ready at ${depinHealthUrl}.`);
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

try {
  if (await apiIsReady()) {
    console.log(`Using the NFT API already running at ${apiHealthUrl}`);
  } else {
    const sponsorSecret = readSponsorSecret();
    const api = track(spawn(npmCommand, ['run', 'dev'], {
      cwd: apiDirectory,
      env: {
        ...process.env,
        STELLAR_SPONSOR_SECRET: sponsorSecret,
        NFT_COLLECTION_WASM_HASH: wasmHash,
        NFT_STORAGE_MODE: process.env.NFT_STORAGE_MODE || 'local',
        NFT_PUBLIC_BASE_URL: process.env.NFT_PUBLIC_BASE_URL || 'http://127.0.0.1:4101',
      },
      stdio: 'inherit',
    }), 'NFT API');
    await waitForApi(api);
    console.log(`NFT API ready at ${apiHealthUrl}`);
  }

  if (await depinIsReady()) {
    console.log(`Using the De-pin gateway already running at ${depinHealthUrl}`);
  } else if (existsSync(depinConfigPath)) {
    const depin = track(spawn(npmCommand, ['run', 'dev'], {
      cwd: depinDirectory,
      env: {
        ...process.env,
        DEPIN_CONFIG_PATH: depinConfigPath,
      },
      stdio: 'inherit',
    }), 'De-pin gateway');
    await waitForDepin(depin);
    console.log(`De-pin gateway ready at ${depinHealthUrl}`);
  } else {
    console.warn(`Skipping De-pin gateway; config not found at ${depinConfigPath}`);
  }

  if (!stopping) {
    track(spawn(npmCommand, ['run', 'dev'], {
      cwd: frontendDirectory,
      env: process.env,
      stdio: 'inherit',
    }), 'Frontend');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Create the testnet identity first or set ZEXVRO_STELLAR_IDENTITY.');
  stop(1);
}
