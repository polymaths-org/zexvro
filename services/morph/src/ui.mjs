const enabled = process.stdout.isTTY && !process.env.NO_COLOR

const wrap =
  (code) =>
  (s) =>
    enabled ? `\x1b[${code}m${s}\x1b[0m` : String(s)

export const c = {
  dim: wrap('2'),
  bold: wrap('1'),
  cyan: wrap('36'),
  green: wrap('32'),
  yellow: wrap('33'),
  red: wrap('31'),
  magenta: wrap('35'),
  white: wrap('37'),
  gray: wrap('90'),
}

export function banner() {
  return [
    '',
    c.cyan('  ███╗   ███╗ ██████╗ ██████╗ ██████╗ ██╗  ██╗'),
    c.cyan('  ████╗ ████║██╔═══██╗██╔══██╗██╔══██╗██║  ██║'),
    c.cyan('  ██╔████╔██║██║   ██║██████╔╝██████╔╝███████║'),
    c.cyan('  ██║╚██╔╝██║██║   ██║██╔══██╗██╔═══╝ ██╔══██║'),
    c.cyan('  ██║ ╚═╝ ██║╚██████╔╝██║  ██║██║     ██║  ██║'),
    c.cyan('  ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝'),
    '',
    c.bold('  ZEXVRO transformation agent') + c.dim('  ·  Web2 → Web3'),
    c.dim('  analyze · strategize · implement · Gate · NFT · De-pin'),
    '',
  ].join('\n')
}

export function info(msg) {
  console.log(c.dim('  · ') + msg)
}

export function ok(msg) {
  console.log(c.green('  ✓ ') + msg)
}

export function warn(msg) {
  console.log(c.yellow('  ! ') + msg)
}

export function err(msg) {
  console.error(c.red('  ✗ ') + msg)
}

export function toolLine(name, detail = '') {
  console.log(c.magenta('  ⚙  ') + c.bold(name) + (detail ? c.dim(`  ${detail}`) : ''))
}

export function assistantBlock(text) {
  console.log('')
  console.log(c.bold(c.cyan('  morph')))
  for (const line of String(text).split('\n')) console.log('  ' + line)
  console.log('')
}

export function userPrompt() {
  return c.bold(c.white('  you')) + c.dim(' › ')
}
