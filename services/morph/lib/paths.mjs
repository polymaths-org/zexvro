import { homedir } from 'node:os'
import { join } from 'node:path'

export function morphDataDir() {
  return process.env.XDG_DATA_HOME
    ? join(process.env.XDG_DATA_HOME, 'morph')
    : join(homedir(), '.local', 'share', 'morph')
}

export function morphConfigDir() {
  return process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, 'morph')
    : join(homedir(), '.config', 'morph')
}

/** ZEXVRO account session (separate from LLM provider keys). */
export function zexvroAuthPath() {
  return join(morphDataDir(), 'zexvro-auth.json')
}

export function defaultApiBase() {
  return (
    process.env.ZEXVRO_API_URL ||
    process.env.VITE_API_URL ||
    '' // AWS DECOUPLED 2026-09-02 — use same-origin/local, no API Gateway
  ).replace(/\/$/, '')
}

export function defaultFrontendUrl() {
  return (process.env.ZEXVRO_FRONTEND_URL || 'https://console.zexvro.in').replace(/\/$/, '')
}

export function defaultGateUrl() {
  return (process.env.ZEXVRO_GATE_URL || 'https://api.zexvro.in/gate').replace(/\/$/, '')
}

export function defaultNftUrl() {
  return (
    process.env.ZEXVRO_NFT_URL ||
    process.env.NFT_API_BASE ||
    '' // AWS DECOUPLED — local /api/nft via Vite
  ).replace(/\/$/, '')
}

export function defaultDepinUrl() {
  return (
    process.env.ZEXVRO_DEPIN_URL ||
    process.env.VITE_DEPIN_API_URL ||
    '' // AWS DECOUPLED — local /api/depin
  ).replace(/\/$/, '')
}
