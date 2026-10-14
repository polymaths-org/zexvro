import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Unit tests for MORPHIC Core (pure Node). UI behaviour is covered by the Playwright e2e suite.
export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared') } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' }
})
