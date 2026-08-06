// THE RUN. Two phases, each resumable, neither ever repaying for work already
// on disk.
//
//   collect  every arm answers every question   ->  raw/<arm>/<row>.json, verbatim
//   judge    one model reads each payload and   ->  verdicts.json
//            rules whether the answer is in it
//
// Usage: node bin/run.mjs [--run=runs/<date>] [--arms=a,b] [--judge=...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnv } from '../lib/env.mjs';
import { ask, pool } from '../lib/llm.mjs';
import { apiUsdPer1k, reportedUnits } from '../lib/cost.mjs';
import { PROVIDERS, callArm, forAgent, paceFor } from '../lib/providers.mjs';
import { judgePrompt, readVerdict } from '../lib/questions.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
loadEnv(ROOT);

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const RUN = `${ROOT}${RUNREL}`;
const JUDGE = arg('judge', 'openai/gpt-5.6-luna');
const ONLY = arg('arms', '').split(',').filter(Boolean);

if (!existsSync(`${RUN}/questions.json`)) {
  throw new Error(`no questions.json in ${RUN} — run bin/import-freshqa.mjs first, and commit it before spending a cent`);
}
const { questions, seed } = JSON.parse(readFileSync(`${RUN}/questions.json`, 'utf8'));

const arms = (ONLY.length ? ONLY : Object.keys(PROVIDERS)).filter((a) => {
  if (process.env[PROVIDERS[a].envKey]) return true;
  console.log(`skipping ${a}: ${PROVIDERS[a].envKey} not set`);
  return false;
});

// WITHIN A VENDOR, CHEAPEST CONFIGURATION FIRST. Tavily's cache is blind to
// search depth in one direction: a `basic` call landing after an `advanced`
// call on the same query is served the advanced payload, at basic's price and
// with `response_time: 0`. Calling cheap-to-expensive keeps both measurements
// honest. Vendors are independent, so their groups run concurrently.
const byVendor = {};
for (const a of arms) (byVendor[PROVIDERS[a].vendor] ||= []).push(a);
for (const v of Object.keys(byVendor)) {
  byVendor[v].sort((x, y) => apiUsdPer1k(x).usd - apiUsdPer1k(y).usd);
}

// ── phase 1: collect ───────────────────────────────────────────────────────
const collectPath = `${RUN}/collect.json`;
const collect = existsSync(collectPath) ? JSON.parse(readFileSync(collectPath, 'utf8')) : [];
const done = new Set(collect.map((c) => `${c.arm}:${c.row}`));
const save = () => writeFileSync(collectPath, `${JSON.stringify(collect, null, 2)}\n`);

console.log(`\ncollect — ${arms.length} arms x ${questions.length} questions, seed ${seed}`);
for (const a of arms) mkdirSync(`${RUN}/raw/${a}`, { recursive: true });

await Promise.all(Object.entries(byVendor).map(async ([vendor, group]) => {
  for (const q of questions) {
    for (const arm of group) {
      // A payload already on disk is already collected. Trusting only the journal
      // meant a run whose raw/ was reused — a rerun, a copy, a resumed loop — paid for
      // thirteen hundred calls it did not need.
      if (done.has(`${arm}:${q.row}`) || existsSync(`${RUN}/raw/${arm}/${q.row}.json`)) continue;
      const r = await callArm(arm, q.question, process.env[PROVIDERS[arm].envKey]);
      const body = forAgent(arm, r.raw);
      writeFileSync(`${RUN}/raw/${arm}/${q.row}.json`, body);
      collect.push({
        arm,
        row: q.row,
        status: r.status,
        ok: r.ok,
        wall_ms: r.wall_ms,
        server_ms: r.server_ms,
        units: reportedUnits(arm, r.raw),
        bytes: body.length,
      });
      save();
      // Spacing is per arm: some free tiers cap requests per minute.
      await new Promise((s) => setTimeout(s, paceFor(arm)));
    }
  }
  console.log(`  ${vendor} done`);
}));

// --collect-only stops here. The judging phase grades against the answer key stored
// with the questions, which for a time-sensitive set goes stale between releases;
// bench.mjs rebuilds the key from the field instead and grades with bin/score.mjs.
if (process.argv.includes('--collect-only')) {
  console.log('\ncollected — stopping before the stored-key judging');
  process.exit(0);
}

// ── phase 2: judge ─────────────────────────────────────────────────────────
// ONE call per payload, and no answer is generated.
//
// The obvious protocol is two models — one writes an answer from the payload,
// another grades it. We ran it and it measured the wrong thing: a reader handed
// a short payload abstains out of caution, so "I don't know" was recorded as
// the API's failure instead of the reader's. Abstentions tracked payload SIZE,
// not payload quality: 26 on the smallest arm, 3 on the largest. Full write-up
// in lib/questions.mjs.
//
// A request that failed is NOT dropped. You were billed at the door, so it
// stays in the denominator as MISSED. A benchmark that quietly removes a
// vendor's failures is measuring something else.
const verdictsPath = `${RUN}/verdicts.json`;
const verdicts = existsSync(verdictsPath) ? JSON.parse(readFileSync(verdictsPath, 'utf8')) : [];
const judged = new Set(verdicts.map((v) => `${v.arm}:${v.row}`));
// `--arms` scopes BOTH phases: judging the whole run when you asked for one
// arm is how you spend six dollars by accident.
const todo = collect.filter((c) => arms.includes(c.arm) && !judged.has(`${c.arm}:${c.row}`));

console.log(`\njudge — ${todo.length} payloads for ${JUDGE} (${verdicts.length} already done)`);
let n = 0;
await pool(todo, 6, async (c) => {
  const q = questions.find((x) => x.row === c.row);
  let row;
  if (!c.ok) {
    row = { arm: c.arm, row: c.row, verdict: 'MISSED', quote: '', tokens: 0, note: `http ${c.status}` };
  } else {
    const payload = readFileSync(`${RUN}/raw/${c.arm}/${c.row}.json`, 'utf8');
    try {
      const a = await ask(JUDGE, judgePrompt(q.question, q.gold, payload));
      const { verdict, quote } = readVerdict(a.text);
      row = { arm: c.arm, row: c.row, verdict, quote, tokens: a.prompt_tokens };
    } catch (e) {
      row = { arm: c.arm, row: c.row, verdict: 'ERROR', quote: '', tokens: null, note: String(e.message).slice(0, 200) };
    }
  }
  verdicts.push(row);
  if (++n % 25 === 0) {
    writeFileSync(verdictsPath, `${JSON.stringify(verdicts, null, 2)}\n`);
    console.log(`  ${n}/${todo.length}`);
  }
});
writeFileSync(verdictsPath, `${JSON.stringify(verdicts, null, 2)}\n`);

console.log(`\ndone — now: node bin/report.mjs --run=${RUNREL}`);
console.log('      then audit every MISSED with a stronger model: node bin/audit.mjs');
