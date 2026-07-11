import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

const OPENCODE_PROVIDER = 'opencode zen';
const OPENCODE_MODEL = 'big-opickle';
const DEFAULT_OPENCODE_CHAT_URL = 'https://api.opencode.ai/v1/chat/completions';

function readRequestBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function getOpenCodeChatUrl(env: Record<string, string>, requestedBaseUrl?: string) {
  const configured = requestedBaseUrl?.trim() || env.OPENCODE_API_URL || env.OPENCODE_BASE_URL || DEFAULT_OPENCODE_CHAT_URL;
  const clean = configured.replace(/\/$/, '');
  return clean.endsWith('/chat/completions') ? clean : `${clean}/chat/completions`;
}

function extractText(payload: any): string {
  return (
    payload?.choices?.[0]?.message?.content ||
    payload?.choices?.[0]?.text ||
    payload?.output_text ||
    payload?.message ||
    ''
  );
}

function opencodeAgentApi(env: Record<string, string>): Plugin {
  return {
    name: 'zexvro-opencode-agent-api',
    configureServer(server) {
      server.middlewares.use('/api/agent/chat', async (req, res) => {
        if (req.method !== 'POST') {
          writeJson(res, 405, { error: 'Method not allowed' });
          return;
        }

        try {
          const body = await readRequestBody(req) as {
            messages?: Array<{ role: string; content: string }>;
            workspace?: string;
            provider?: string;
            model?: string;
            apiKey?: string;
            baseUrl?: string;
          };
          const requestApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
          const requestedBaseUrl = typeof body.baseUrl === 'string' ? body.baseUrl : '';
          const provider = typeof body.provider === 'string' && body.provider.trim()
            ? body.provider.trim()
            : env.OPENCODE_PROVIDER || OPENCODE_PROVIDER;
          const model = typeof body.model === 'string' && body.model.trim()
            ? body.model.trim()
            : env.OPENCODE_MODEL || OPENCODE_MODEL;
          const apiKey = requestApiKey || process.env.OPENCODE_API_KEY || env.OPENCODE_API_KEY;
          if (!apiKey) {
            writeJson(res, 503, {
              error: 'Add an opencode API key in Settings or set OPENCODE_API_KEY on the dev server.',
            });
            return;
          }

          const messages = Array.isArray(body.messages) ? body.messages : [];
          if (!messages.length) {
            writeJson(res, 400, { error: 'No messages provided.' });
            return;
          }

          const upstream = await fetch(getOpenCodeChatUrl(env, requestedBaseUrl), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider,
              model,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are Morph inside the ZEXVRO Agentic Operations console. Be concise, practical, and focused on workspace operations, transformation planning, CLI auth, and safe next steps. Do not claim to run deployments or change files from the browser.',
                },
                ...messages,
              ],
              metadata: {
                workspace: body.workspace || 'ZEXVRO',
              },
            }),
          });

          const responseBody = await upstream.json().catch(() => ({}));
          if (!upstream.ok) {
            writeJson(res, upstream.status, {
              error: responseBody?.error?.message || responseBody?.message || `opencode request failed with ${upstream.status}`,
            });
            return;
          }

          writeJson(res, 200, {
            text: extractText(responseBody) || 'opencode returned an empty response.',
            provider,
            model,
          });
        } catch (error) {
          writeJson(res, 500, {
            error: error instanceof Error ? error.message : 'Agent request failed.',
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Prefer repository-root env when present so frontend-only `npm run dev`
  // still picks up the unified template without a per-folder `.env`.
  const env = {
    ...loadEnv(mode, path.resolve(__dirname, '..'), ''),
    ...loadEnv(mode, process.cwd(), ''),
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => (
        typeof entry[1] === 'string'
      )),
    ),
  };
  return {
    plugins: [opencodeAgentApi(env), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/nft': {
          target: env.NFT_API_PROXY_TARGET || 'http://127.0.0.1:4101',
          changeOrigin: false,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/nft/, ''),
        },
        '/api/depin': {
          target: env.DEPIN_API_PROXY_TARGET || 'http://127.0.0.1:4102',
          changeOrigin: false,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/depin/, ''),
        },
      },
    },
  };
});
