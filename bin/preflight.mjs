// PRE-FLIGHT. Run this before every full run, without exception.
//
// A question set has properties that decide whether it can be used AT ALL with
// this protocol, and they are not in the paper's abstract. Three full runs were
// paid for and thrown away before this script existed, each time because
// something checkable in ten minutes was checked afterwards instead.
//
// Three questions, in this order:
//   1. Do the providers ACCEPT the queries? (length caps differ per vendor)
//   2. Is the gold still what the web says TODAY? (a dated set goes stale)
//   3. Do all arms fail together while agreeing on some OTHER answer?
//      That is the signature of an expired gold, not of bad search engines.
//
// Usage: node bin/preflight.mjs [--run=runs/<date>] [--n=15] [--arms=a,b,c]
import { readFileSync } from 'node:fs';
import { loadEnv } from '../lib/env.mjs';
import { PROVIDERS, callArm, forAgent } from '../lib/providers.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
loadEnv(ROOT);

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUN = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const N = parseInt(arg('n', 15), 10);
const ARMS = arg('arms', 'tavily-basic,firecrawl-search,serpdive-mako').split(',');

const set = JSON.parse(readFileSync(`${ROOT}${RUN}/questions.json`, 'utf8'));
const sample = set.questions.slice(0, N);

// ── 1. query limits, offline and free ──────────────────────────────────────
const tooLong = set.questions.filter((q) => q.question.length > 400 || q.question.split(/\s+/).length > 50);
console.log(`1. QUERY LIMITS — ${set.questions.length} questions`);
console.log(tooLong.length
  ? `   ${tooLong.length} exceed 400 chars or 50 words: Brave, You.com and Tavily will refuse them. FIX THE SET.`
  : '   all within every provider\'s cap (<=400 chars, <=50 words) — OK');

// ── 2 and 3. does the gold still match what comes back today ───────────────
const hasGold = (payload, answers) => {
  const t = payload.toLowerCase();
  return answers.some((g) => {
    const s = g.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '').toLowerCase();
    return s.length >= 2 && t.includes(s);
  });
};

console.log(`\n2. GOLD vs TODAY'S WEB — ${sample.length} questions x ${ARMS.length} arms`);
let anyArmHasGold = 0;
const misses = [];
for (const q of sample) {
  const answers = q.answers ?? String(q.gold).split(' | ');
  const hits = [];
  for (const arm of ARMS) {
    const r = await callArm(arm, q.question, process.env[PROVIDERS[arm].envKey]);
    hits.push(hasGold(forAgent(arm, r.raw), answers) ? arm : null);
    await new Promise((s) => setTimeout(s, 500));
  }
  const found = hits.filter(Boolean).length;
  if (found) anyArmHasGold++; else misses.push(q);
  console.log(`   ${found ? 'GOLD' : ' -- '} ${found}/${ARMS.length}  ${q.question.slice(0, 62)}`);
}

const rate = Math.round((anyArmHasGold / sample.length) * 100);
console.log(`\n   gold present in at least one arm's payload: ${anyArmHasGold}/${sample.length} (${rate}%)`);

// ── verdict ────────────────────────────────────────────────────────────────
// If no arm can even SEE the gold, no amount of reading will produce it. A set
// where that happens often is telling you its answers have moved on.
console.log('\n3. VERDICT');
if (tooLong.length) console.log('   STOP — some questions are unusable by at least one provider.');
else if (rate < 60) console.log(`   STOP — only ${rate}% of golds appear anywhere. The set is likely stale for this protocol.`);
else if (rate < 75) console.log(`   CAUTION — ${rate}%. Usable, but expect a depressed ceiling; check the misses below by hand.`);
else console.log(`   GO — ${rate}% of golds are retrievable today. The set holds.`);

if (misses.length) {
  console.log('\n   questions no arm could ground — read these before spending:');
  for (const q of misses.slice(0, 8)) console.log(`     ${q.question.slice(0, 70)}  → gold: ${String(q.gold).slice(0, 40)}`);
}
