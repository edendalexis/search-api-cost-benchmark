// Turns a FreshQA release into this harness's questions.json.
//
// FreshQA is Google's set of questions that require up-to-date knowledge. Its
// ANSWERS are re-checked and republished weekly, and each question is labelled
// with how fast its answer moves. We take the `fast-changing` ones.
//
// That label is the whole reason this set is here. A benchmark built on settled
// facts can be tuned against once and stays tuned forever — the answer to a
// 2017 trivia question will be the same in 2030. The answer to "who is the
// latest Formula 1 world champion" will not. Overfitting a retrieval stack to a
// moving target buys nothing, so the score has to come from actually going and
// looking.
//
// Two structural details of the file:
//   - a question carries up to ten acceptable answers (`answer_0`..`answer_9`),
//     so the grader is given all of them and any one counts;
//   - `false_premise` questions ask about things that never happened. They are
//     excluded here and belong in a separate hallucination table, because
//     "correct" means something different for them.
//
// Usage: node bin/import-freshqa.mjs [--n=100] [--seed=20260729]
//          [--fact-type=fast-changing] [--split=TEST] [--run=runs/<date>]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnv } from '../lib/env.mjs';
import { ask, pool } from '../lib/llm.mjs';
import { closedBookPrompt, readScreen, screenPrompt, shuffled } from '../lib/questions.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
loadEnv(ROOT);

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const N = parseInt(arg('n', 100), 10);
const SEED = parseInt(arg('seed', 20260729), 10);
const MODEL = arg('model', 'anthropic/claude-haiku-4.5');
const FACT_TYPE = arg('fact-type', 'fast-changing');
const SPLIT = arg('split', 'TEST');
const FILE = arg('file', `${ROOT}cache/freshqa-2026-04-21.csv`);
const RUN = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);

/** Minimal RFC4180 parser — quoted fields, escaped quotes, embedded newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// The sheet opens with a banner row before the real header.
const grid = parseCsv(readFileSync(FILE, 'utf8'));
const h = grid.findIndex((r) => r[0] === 'id');
const header = grid[h];
const all = grid.slice(h + 1).filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(header.map((k, i) => [k, r[i] ?? ''])));

const pickAnswers = (d) => Array.from({ length: 10 }, (_, i) => d[`answer_${i}`]).filter((a) => a && a.trim());

// THE FILTER THAT MATTERS IS `next_review`, NOT `fact_type`.
//
// FreshQA states, per question, when its answer will next need re-checking.
// Some carry a DATE — the authors certifying the gold holds until then. Others
// carry `frequently` or `every_time`, meaning the answer moves constantly.
//
// Filtering on `fact_type: fast-changing` scoops up the `frequently` bucket and
// hands you a gold that expired weeks ago. Measured: on a run built that way,
// 28 of 100 questions had all twelve arms fail together, converging on a newer
// answer than the gold. The engines were right and the file was old.
//
// So: keep a question only if its review date is still ahead of us, or if the
// authors marked it as rarely needing review at all.
const TODAY = new Date();
const reviewDate = (v) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((v || '').trim());
  return m ? new Date(`${m[3]}-${m[1]}-${m[2]}T00:00:00Z`) : null;
};
const goldStillValid = (d) => {
  const when = reviewDate(d.next_review);
  if (when) return when > TODAY;                       // certified until that date
  return ['occasionally', 'hardly_ever'].includes(d.next_review); // rarely moves
};

const eligible = all
  .filter((d) => d.split === SPLIT)
  .filter((d) => d.fact_type !== 'never-changing')
  .filter((d) => goldStillValid(d))
  .filter((d) => d.false_premise?.toUpperCase() !== 'TRUE')
  .filter((d) => pickAnswers(d).length > 0)
  .map((d) => ({
    row: Number(d.id),
    question: d.question,
    gold: pickAnswers(d).join(' | '),
    answers: pickAnswers(d),
    fact_type: d.fact_type,
    next_review: d.next_review,
    num_hops: d.num_hops,
    effective_year: d.effective_year,
    source: d.source,
  }));

const certified = eligible.filter((q) => reviewDate(q.next_review)).length;
console.log(`FreshQA: ${all.length} questions → ${eligible.length} usable in split ${SPLIT}`);
console.log(`  ${certified} with a review date still ahead (gold certified valid), ${eligible.length - certified} marked as rarely moving`);
const order = shuffled(eligible, SEED);

// A question the reader already knows measures its memory, not the search API.
const kept = [];
const dropped = [];
let cursor = 0;
while (kept.length < N && cursor < order.length) {
  const batch = order.slice(cursor, cursor + Math.ceil((N - kept.length) * 1.4));
  cursor += batch.length;
  const checked = await pool(batch, 4, async (q) => {
    try {
      const a = await ask(MODEL, closedBookPrompt(q.question));
      const g = readScreen((await ask(MODEL, screenPrompt(q.question, q.gold, a.text))).text);
      return { ...q, closed_book_answer: a.text, closed_book_grade: g };
    } catch (e) {
      return { ...q, closed_book_grade: 'SCREEN_FAILED', error: String(e.message).slice(0, 200) };
    }
  });
  for (const q of checked) {
    if (kept.length >= N) break;
    if (q.closed_book_grade === 'CORRECT' || q.closed_book_grade === 'SCREEN_FAILED') dropped.push(q);
    else kept.push(q);
  }
  console.log(`  screened ${cursor} — kept ${kept.length}/${N}`);
}

mkdirSync(`${ROOT}${RUN}`, { recursive: true });
const knew = dropped.filter((d) => d.closed_book_grade === 'CORRECT').length;
writeFileSync(`${ROOT}${RUN}/questions.json`, `${JSON.stringify({
  source: 'FreshQA (Google), version 2026-04-21 — https://github.com/freshllms/freshqa',
  note: 'fast-changing questions only, false-premise excluded. Answers are re-checked weekly by the dataset authors; a run is therefore tied to the version named above. Each question carries several acceptable answers and the grader accepts any of them.',
  seed: SEED,
  n: kept.length,
  selection: 'next_review still ahead, or marked occasionally/hardly_ever; never-changing and false-premise excluded',
  split: SPLIT,
  screened: cursor,
  screening_model: MODEL,
  dropped_because_model_knew: knew,
  questions: kept.map(({ closed_book_answer, closed_book_grade, ...q }) => q),
  dropped,
}, null, 2)}\n`);

console.log(`\n${kept.length} questions frozen in ${RUN}/questions.json`);
console.log(`${knew} of ${cursor} screened (${Math.round((knew / cursor) * 100)}%) were already known to ${MODEL}.`);
