// Seeds the SpacetimeDB labs database from the in-repo sample labs.
// Usage: node scripts/seed-spacetime.mjs [--db labs-beta]
// Env: SPACETIME_URL (default https://maincloud.spacetimedb.com)
//
// Private task answers are derived from the sample tasks and stored in the
// private answers table, never in the public rows. No image bytes are
// seeded: banner references stay empty unless they are already hosted URLs.
import { sampleLabs } from '../src/data/mockData.ts';

const BASE = (process.env.SPACETIME_URL || 'https://maincloud.spacetimedb.com').replace(/\/$/, '');
const DB = process.argv.includes('--db') ? process.argv[process.argv.indexOf('--db') + 1] : 'labs-beta';

const opt = (v) => (v === undefined || v === null ? { none: {} } : { some: v });

async function call(reducer, args) {
  const res = await fetch(`${BASE}/v1/database/${DB}/call/${reducer}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${reducer} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

function collectAnswers(lab) {
  const answers = {};
  const tasks = [...(lab.tasks || [])];
  for (const page of lab.pages || []) tasks.push(...(page.elements || []));
  for (const t of tasks) {
    if (!t || !t.id) continue;
    const entry = {};
    if (t.expectedFlag) entry.flag = t.expectedFlag;
    if (t.verificationCommand) entry.command = t.verificationCommand;
    if (t.expectedOutput) entry.output = t.expectedOutput;
    if (Object.keys(entry).length > 0) answers[t.id] = entry;
  }
  return answers;
}

const labs = sampleLabs.filter((l) => l.isPublished !== false);
for (const lab of labs) {
  await call('upsert_lab_summary', {
    id: lab.id,
    slug: lab.slug,
    title: lab.title,
    description_snippet: (lab.description || '').slice(0, 280),
    category: lab.category,
    difficulty: lab.difficulty,
    duration_minutes: lab.durationMinutes || 0,
    xp_reward: lab.xpReward || 0,
    is_published: lab.isPublished !== false && lab.status !== 'draft',
    featured: lab.featured || false,
    banner_url: opt(undefined),
    banner_hash: opt(undefined),
  });
  await call('save_lab_content', {
    lab_id: lab.id,
    overview_ref: lab.overviewMarkdown || '',
    pages_json: JSON.stringify({
      overviewMarkdown: lab.overviewMarkdown || '',
      tasks: lab.tasks || [],
      pages: lab.pages || [],
      author: lab.author || 'ZEXVRO Labs Team',
      createdAt: lab.createdAt || '',
      tags: lab.tags || [],
      timeLimitMinutes: lab.timeLimitMinutes ?? null,
      moduleId: lab.moduleId,
      status: lab.status,
      editors: lab.editors || [],
      rules: lab.rules || [],
      credential: lab.credential,
      credentialName: lab.credentialName,
      badgeId: lab.badgeId,
      badgeName: lab.badgeName,
      badgeIconUrl: lab.badgeIconUrl,
    }),
    initial_code: opt(lab.initialCode),
    initial_terminal_command: opt(lab.initialTerminalCommand),
  });
  await call('save_lab_private', {
    lab_id: lab.id,
    answers_json: JSON.stringify(collectAnswers(lab)),
    access_code_hash: opt(undefined),
  });
  console.log(`seeded ${lab.id} (${Object.keys(collectAnswers(lab)).length} verifiable tasks)`);
}
console.log(`done: ${labs.length} labs -> ${DB}`);
