#!/usr/bin/env node
/** Morph — ZEXVRO transformation agent */
import { main } from '../src/cli.mjs'

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  if (e instanceof Error && e.stack) {
    // only dump stack when MORPH_DEBUG=1
    if (process.env.MORPH_DEBUG) console.error(e.stack)
  }
  process.exit(1)
})
