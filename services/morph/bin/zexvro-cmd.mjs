#!/usr/bin/env node
import { runZexvroCommand } from '../lib/zexvro-cli.mjs'
await runZexvroCommand(process.argv.slice(2))
