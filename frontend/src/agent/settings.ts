import { memoryApi } from '../api/api';
import { buildMorphSystemPrompt, type MorphRouteContext } from './platformKb';

/** Platform Morph assistant defaults (server holds the real key in production). */
export const OPENCODE_PROVIDER = 'codexin';
export const OPENCODE_MODEL = 'grok-4.5';
const AGENT_SETTINGS_MEMORY_KEY = 'agentSettings';

export type AgentSettings = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
};

export type AgentChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export const defaultAgentSettings: AgentSettings = {
  provider: OPENCODE_PROVIDER,
  model: OPENCODE_MODEL,
  // Empty = use API Lambda proxy defaults (CodexIn / Grok 4.5 in production)
  baseUrl: '',
  apiKey: '',
};

let cachedAgentSettings: AgentSettings = defaultAgentSettings;

function normalizeAgentSettings(value: unknown): AgentSettings {
  if (!value || typeof value !== 'object') return defaultAgentSettings;
  const settings = value as Partial<AgentSettings>;

  return {
    provider: typeof settings.provider === 'string' && settings.provider.trim()
      ? settings.provider
      : defaultAgentSettings.provider,
    model: typeof settings.model === 'string' && settings.model.trim()
      ? settings.model
      : defaultAgentSettings.model,
    baseUrl: typeof settings.baseUrl === 'string' ? settings.baseUrl : '',
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
  };
}

export function loadAgentSettings(): AgentSettings {
  return cachedAgentSettings;
}

export async function loadAgentSettingsFromAWS(): Promise<AgentSettings> {
  try {
    const response = await memoryApi.get();
    cachedAgentSettings = normalizeAgentSettings(response.memory?.[AGENT_SETTINGS_MEMORY_KEY]);
  } catch (err) {
    console.error('Failed to load agent settings from AWS:', err);
    cachedAgentSettings = defaultAgentSettings;
  }
  return cachedAgentSettings;
}

export async function saveAgentSettings(settings: AgentSettings) {
  const normalized = normalizeAgentSettings(settings);
  cachedAgentSettings = normalized;
  await memoryApi.update({ [AGENT_SETTINGS_MEMORY_KEY]: normalized });
}

export function buildAgentChatPayload(
  workspace: string,
  messages: AgentChatMessage[],
  settings: AgentSettings = loadAgentSettings(),
  routeContext?: MorphRouteContext,
) {
  const apiKey = settings.apiKey.trim();
  const baseUrl = settings.baseUrl.trim();
  const provider = settings.provider.trim() || defaultAgentSettings.provider;
  const model = settings.model.trim() || defaultAgentSettings.model;

  const hasSystem = messages.some((m) => m.role === 'system');
  const withSystem: AgentChatMessage[] = hasSystem
    ? messages
    : [
        {
          role: 'system',
          content: buildMorphSystemPrompt(routeContext || {}),
        },
        ...messages,
      ];

  return {
    workspace,
    messages: withSystem,
    provider,
    model,
    apiKey: apiKey || undefined,
    baseUrl: baseUrl || undefined,
  };
}

export { buildMorphSystemPrompt };
export type { MorphRouteContext };
