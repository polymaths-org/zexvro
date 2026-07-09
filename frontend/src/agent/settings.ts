export const OPENCODE_PROVIDER = 'opencode zen';
export const OPENCODE_MODEL = 'big-opickle';
export const AGENT_SETTINGS_STORAGE_KEY = 'zexvro_agent_settings';

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
  baseUrl: '',
  apiKey: '',
};

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
  if (typeof window === 'undefined') return defaultAgentSettings;

  const saved = window.localStorage.getItem(AGENT_SETTINGS_STORAGE_KEY);
  if (!saved) return defaultAgentSettings;

  try {
    return normalizeAgentSettings(JSON.parse(saved));
  } catch {
    return defaultAgentSettings;
  }
}

export function saveAgentSettings(settings: AgentSettings) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeAgentSettings(settings);
  window.localStorage.setItem(AGENT_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
}

export function buildAgentChatPayload(
  workspace: string,
  messages: AgentChatMessage[],
  settings: AgentSettings = loadAgentSettings(),
) {
  const apiKey = settings.apiKey.trim();
  const baseUrl = settings.baseUrl.trim();
  const provider = settings.provider.trim() || defaultAgentSettings.provider;
  const model = settings.model.trim() || defaultAgentSettings.model;

  return {
    workspace,
    messages,
    provider,
    model,
    apiKey: apiKey || undefined,
    baseUrl: baseUrl || undefined,
  };
}
