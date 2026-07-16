/**
 * Facilitator auth helpers for Stellar x402.
 * OpenZeppelin Channels requires Bearer auth; public x402.org probes do not.
 */

export function facilitatorAuthConfigured(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const key =
    environment.OZ_API_KEY?.trim() ||
    environment.X402_FACILITATOR_API_KEY?.trim() ||
    ''
  return key.length > 0
}

export function isOpenZeppelinChannelsFacilitator(facilitatorUrl: string): boolean {
  try {
    const host = new URL(facilitatorUrl).hostname.toLowerCase()
    return (
      host === 'channels.openzeppelin.com' ||
      host.endsWith('.channels.openzeppelin.com')
    )
  } catch {
    return false
  }
}

export interface FacilitatorReadiness {
  authConfigured: boolean
  ozChannels: boolean
  settleAuthRequired: boolean
  /** True when settle can proceed with current env (OZ Channels needs API key). */
  settleReady: boolean
}

export function facilitatorSettleReadiness(
  facilitatorUrl: string,
  environment: NodeJS.ProcessEnv = process.env,
): FacilitatorReadiness {
  const authConfigured = facilitatorAuthConfigured(environment)
  const ozChannels = isOpenZeppelinChannelsFacilitator(facilitatorUrl)
  return {
    authConfigured,
    ozChannels,
    settleAuthRequired: ozChannels,
    settleReady: !ozChannels || authConfigured,
  }
}

export function resolveFacilitatorApiKey(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return (
    environment.OZ_API_KEY?.trim() ||
    environment.X402_FACILITATOR_API_KEY?.trim() ||
    ''
  )
}
