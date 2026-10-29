import { describe, expect, it } from 'vitest'
import {
  assertPayerAllowed,
  capabilityFingerprint,
  extractPayerFromPaymentPayload,
} from './capabilityGate.js'

describe('capabilityGate helpers', () => {
  it('assertPayerAllowed self mode', () => {
    expect(
      assertPayerAllowed({ stellar_pk: 'GABC', pay_mode: 'self' }, 'GABC').ok,
    ).toBe(true)
    expect(
      assertPayerAllowed({ stellar_pk: 'GABC', pay_mode: 'self' }, 'GXYZ').ok,
    ).toBe(false)
  })

  it('assertPayerAllowed allowlist', () => {
    const r = assertPayerAllowed(
      { stellar_pk: 'GAGENT', pay_mode: 'sponsored', allowed_payer_pks: ['GTREAS'] },
      'GTREAS',
    )
    expect(r.ok).toBe(true)
  })

  it('extractPayerFromPaymentPayload finds G address', () => {
    const payer = extractPayerFromPaymentPayload({
      payload: { accepted: { extra: { payer: 'GCSPMRWNIC4CLCGGWX42GH4TFXC3RAHNO5VHMKHRPBN6EJ56T6AZTDK3' } } },
    })
    expect(payer?.startsWith('G')).toBe(true)
  })

  it('capabilityFingerprint is stable hex', () => {
    const a = capabilityFingerprint('cap')
    const b = capabilityFingerprint('cap')
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]+$/)
  })
})

import {verifyCapabilityWithGate} from './capabilityGate.js'
import type {Request} from 'express'
describe('Gate response validation',()=>{
 it.each([{}, {ok:false}, {ok:true,class:'unknown',action:'paid.read'}, {ok:true,class:'agent',action:'wrong'}, {ok:true,class:'human',action:'paid.read'}])('rejects malformed or mismatched 200 responses %j',async body=>{
  const req={header:()=> 'capability-fixture',method:'GET',path:'/paid',protocol:'https',originalUrl:'/paid',get:()=> 'api.example'} as unknown as Request
  const result=await verifyCapabilityWithGate(req,{gateApiBase:'https://gate.example',siteSecret:'fixture',action:'paid.read',minClass:'agent'},async()=>Response.json(body))
  expect(result.ok).toBe(false)
 });
})
