#!/usr/bin/env node
/**
 * Morph — self-contained ZEXVRO agent (no OpenCode required).
 */
import { main } from '../src/cli.mjs'

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
