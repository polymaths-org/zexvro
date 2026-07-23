#!/usr/bin/env node
/** Morph — ZEXVRO transformation agent (self-contained). */
import { main } from '../src/cli.mjs'
main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
