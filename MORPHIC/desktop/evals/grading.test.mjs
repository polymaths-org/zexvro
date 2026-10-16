import test from 'node:test'
import assert from 'node:assert/strict'
import { gradeTrace } from './regrade.mjs'
const trace = (name, task, text = '') => ({ result: { case: name, checks: {} }, sessions: [{ messages: [{ role: 'morph', text, task }] }], calls: [], fixture: { media: [] } })
test('a hidden checkpoint is not an answer to the user', () => {
  const hidden = trace('dynamic', { status: 'done', checkpoint: { text: 'TECH-402' }, result: 'Done.' })
  assert.equal(gradeTrace(hidden).pass, false)
  hidden.sessions[0].messages[0].task.result = 'The code is TECH-402.'
  assert.equal(gradeTrace(hidden).pass, true)
})
test('paused work fails even after an effect was achieved', () => {
  const paused = trace('media', { status: 'paused' })
  paused.result.checks.text_alternatives = true
  paused.fixture.media = [{ color: 'teal' }]
  assert.equal(gradeTrace(paused).pass, false)
})
test('a duplicate effect fails even when the agent says done', () => {
  const duplicate = trace('media', { status: 'done' })
  duplicate.result.checks.text_alternatives = true
  duplicate.fixture.media = [{ color: 'teal' }, { color: 'teal' }]
  assert.equal(gradeTrace(duplicate).pass, false)
})

test('expected impossibility requires explicit blocked state, never a generic pause or done',()=>{
 const t=trace('impossible',{status:'paused',result:'No 64 GB RAM product available'})
 t.result.expectedOutcome='blocked';t.result.checks.no_mutation=true
 assert.equal(gradeTrace(t).pass,false)
 t.sessions[0].messages[0].task.status='done';assert.equal(gradeTrace(t).pass,false)
 t.sessions[0].messages[0].task.status='blocked';assert.equal(gradeTrace(t).pass,true)
})
test('human-input case requires a pending handoff, not automatic acceptance or an ordinary approval',()=>{
 const t=trace('auth',{status:'waiting'});t.result.expectedOutcome='needs_input'
 const m=t.sessions[0].messages[0];m.approval={kind:'confirm',status:'pending'}
 assert.equal(gradeTrace(t).pass,false)
 m.approval.kind='handoff';assert.equal(gradeTrace(t).pass,true)
 m.approval.status='allowed';assert.equal(gradeTrace(t).pass,false)
})

test('upstream DNS outage is an infrastructure outcome and not scored as success',()=>{
 const t=trace('reconcile',undefined);t.sessions[0].messages[0].failed=true
 t.calls=[{status:502,response:JSON.stringify({error:{message:'dial tcp: lookup opencode.ai: Temporary failure in name resolution'}})}]
 const r=gradeTrace(t);assert.equal(r.pass,false);assert.equal(r.outcome,'provider_unavailable')
})
test('a correct impossibility proof with done is a state mismatch rather than a fabricated result',()=>{
 const t=trace('calendar-impossible',{status:'done',result:'Maximum overlap is 30 minutes, below 90.'})
 t.result.expectedOutcome='blocked';t.result.checks.evidenced_overlap=true
 assert.equal(gradeTrace(t).outcome,'terminal_mismatch')
})
