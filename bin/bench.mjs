// One command, start to finish, until the run really holds N questions.
//
// A benchmark of time-sensitive questions cannot ship a frozen answer key: FreshQA's
// was last republished in April and by August thirteen of the published hundred were
// simply wrong — the payloads carried the current truth and the run scored them as
// failures, costing every arm between eight and eighteen points. So the key is rebuilt
// on the day of the run, by the field: every arm answers, and what they converge on is
// today's answer.
//
// The field does not always converge. Those questions cannot be scored, and dropping
// them silently would leave the run short — which is how a "hundred-question benchmark"
// quietly became seventy-nine. So this loops: draw, collect, arbitrate, and for every
// question the field could not settle, draw a replacement of the same fact type and
// go again, until N stand or the rounds run out.
//
// Each round only fetches what it does not already have, so the second pass costs the
// replacements and nothing else.
//
//   node bin/bench.mjs [--n=100] [--run=runs/<date>] [--rounds=4] [--arms=a,b]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const N = parseInt(arg('n', 100), 10);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const RUN = `${ROOT}${RUNREL}/`;
const ROUNDS = parseInt(arg('rounds', 4), 10);
const ARMS = arg('arms', '');
const VOTERS = arg('voters', '');

const step = (script, extra = []) => {
  const r = spawnSync('node', [`${ROOT}bin/${script}`, `--run=${RUNREL}`, ...extra],
    { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) throw new Error(`${script} failed`);
};

// FreshQA ships one row per question with its fact type; a replacement keeps the type
// so that dropping the hard ones cannot quietly make the set easier.
const parseCsv = (t) => {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
};
const pool = (() => {
  const f = `${ROOT}cache/freshqa-2026-04-21.csv`;
  if (!existsSync(f)) return null;
  const grid = parseCsv(readFileSync(f, 'utf8'));
  const h = grid.findIndex((r) => r[0] === 'id');
  const cols = grid[h];
  const at = (r, n) => r[cols.indexOf(n)];
  return grid.slice(h + 1)
    .filter((r) => at(r, 'question') && at(r, 'false_premise') !== 'TRUE')
    .map((r) => ({
      row: Number(at(r, 'id')), question: at(r, 'question'),
      answers: cols.map((c, j) => (c.startsWith('answer_') ? r[j] : '')).filter(Boolean),
      fact_type: at(r, 'fact_type'), next_review: at(r, 'next_review'),
      num_hops: at(r, 'num_hops'), effective_year: at(r, 'effective_year'), source: at(r, 'source'),
    }))
    .map((q) => ({ ...q, gold: q.answers[0] || '' }));
})();

const meta = JSON.parse(readFileSync(`${RUN}questions.json`, 'utf8'));
let questions = meta.questions || meta;
let seed = (meta.seed || 20260101) >>> 0;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const seen = new Set(questions.map((q) => String(q.row)));

const settled = () => {
  const g = JSON.parse(readFileSync(`${RUN}gold-today.json`, 'utf8'));
  return Object.entries(g).filter(([, x]) => x.gold_today).map(([r]) => r);
};

for (let round = 1; round <= ROUNDS; round++) {
  console.log(`\n──────── round ${round}/${ROUNDS} — ${questions.length} questions in play`);
  step('run.mjs', ARMS ? [`--arms=${ARMS}`, '--collect-only'] : ['--collect-only']);
  step('gold.mjs', [...(VOTERS ? [`--voters=${VOTERS}`] : []), ...(existsSync(`${RUN}readings.json`) ? ['--reuse=readings.json'] : [])]);

  const ok = settled();
  console.log(`\n${ok.length}/${N} questions settled by the field`);
  if (ok.length >= N || !pool) break;

  // replace what could not be settled, type for type, never a row already drawn
  const okSet = new Set(ok);
  const lost = questions.filter((q) => !okSet.has(String(q.row)));
  const want = {};
  for (const q of lost) want[q.fact_type] = (want[q.fact_type] || 0) + 1;
  const picked = [];
  for (const [type, n] of Object.entries(want)) {
    const cand = pool.filter((q) => q.fact_type === type && !seen.has(String(q.row)));
    for (let i = 0; i < n && cand.length; i++) {
      const q = cand.splice(Math.floor(rnd() * cand.length), 1)[0];
      seen.add(String(q.row)); picked.push(q);
    }
  }
  if (!picked.length) { console.log('no replacements left in the pool'); break; }
  console.log(`${lost.length} unsettled, ${picked.length} drawn to replace them`);

  questions = [...questions.filter((q) => okSet.has(String(q.row))), ...picked];
  writeFileSync(`${RUN}questions.json`, JSON.stringify({ ...meta, questions, n: questions.length, seed }, null, 1));
  // the verdicts already reached stand; only the newcomers will be arbitrated
  const g = JSON.parse(readFileSync(`${RUN}gold-today.json`, 'utf8'));
  writeFileSync(`${RUN}gold-today.json`,
    JSON.stringify(Object.fromEntries(Object.entries(g).filter(([, x]) => x.gold_today)), null, 1));
}

step('tokens.mjs');
// The token count above is charged on our reader's tokenizer. The buyer pays a
// different model a different count for the same bytes, so the ratio is measured on
// real payloads before anything is priced.
step('reprice.mjs');
step('score.mjs');
step('table.mjs');
console.log(`\ndone — ${RUNREL}/report.md, docs/table-*.svg, README updated`);
