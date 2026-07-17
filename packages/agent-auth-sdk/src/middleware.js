/**
 * Express middleware: require Gate capability on a route.
 * Origin servers call Gate /v1/verify (or inject a custom verifyFn).
 */

import { CAPABILITY_HEADER, POP_HEADER, verifyCapabilityRemote } from './index.js'

/**
 * @param {{
 *   apiBase: string,
 *   siteSecret: string,
 *   action: string,
 *   minClass?: 'human'|'agent'|'either',
 *   expectedOrigin?: string | ((req: any) => string | undefined),
 *   requirePop?: boolean,
 *   verifyFn?: Function,
 * }} options
 */
export function gateMiddleware(options) {
  if (!options?.apiBase) throw new Error('apiBase required')
  if (!options?.siteSecret) throw new Error('siteSecret required')
  if (!options?.action) throw new Error('action required')

  return async function requireGate(req, res, next) {
    try {
      const headerName = CAPABILITY_HEADER
      const capability =
        req.headers[headerName] ||
        req.headers['x-zexvro-capability'] ||
        (req.body && req.body.capability)

      const popHeader = req.headers[POP_HEADER] || req.headers['x-zexvro-pop']
      let pop = req.body?.pop
      if (!pop && typeof popHeader === 'string' && popHeader.startsWith('{')) {
        try {
          pop = JSON.parse(popHeader)
        } catch {
          /* ignore */
        }
      }

      const expectedOrigin =
        typeof options.expectedOrigin === 'function'
          ? options.expectedOrigin(req)
          : options.expectedOrigin

      if (!capability) {
        res.status(401)
        res.setHeader('content-type', 'application/problem+json')
        res.json({
          type: 'https://zexvro.dev/problems/gate/missing-capability',
          title: 'missing_capability',
          status: 401,
          detail: `Missing ${headerName} header`,
          error_code: 'missing_capability',
        })
        return
      }

      if (options.requirePop && !pop) {
        res.status(401)
        res.setHeader('content-type', 'application/problem+json')
        res.json({
          type: 'https://zexvro.dev/problems/gate/pop-required',
          title: 'pop_required',
          status: 401,
          detail: 'Origin requires X-Zexvro-Pop for this route',
          error_code: 'pop_required',
        })
        return
      }

      const expectedHtm =
        options.expectedHtm === true
          ? req.method
          : typeof options.expectedHtm === 'function'
            ? options.expectedHtm(req)
            : options.expectedHtm
      const expectedHtu =
        options.expectedHtu === true
          ? `${req.protocol}://${req.get('host')}${req.originalUrl}`
          : typeof options.expectedHtu === 'function'
            ? options.expectedHtu(req)
            : options.expectedHtu

      const verify = options.verifyFn || verifyCapabilityRemote
      const result = await verify({
        apiBase: options.apiBase,
        siteSecret: options.siteSecret,
        capability,
        action: options.action,
        minClass: options.minClass || 'either',
        expectedOrigin,
        pop,
        expectedHtm,
        expectedHtu,
        expectedBodyHash: options.expectedBodyHash,
        requireHumanPop: options.requireHumanPop,
      })

      if (!result.ok) {
        res.status(result.status || 401)
        res.setHeader('content-type', 'application/problem+json')
        res.json(result.problem || { error: 'gate_denied' })
        return
      }

      req.gate = result
      next()
    } catch (err) {
      res.status(500).json({
        type: 'https://zexvro.dev/problems/gate/internal',
        title: 'gate_middleware_error',
        status: 500,
        detail: err instanceof Error ? err.message : 'middleware failed',
        error_code: 'gate_middleware_error',
      })
    }
  }
}

export default gateMiddleware
