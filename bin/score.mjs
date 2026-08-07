// The leaderboard, scored against an answer key dated the day of the run.
//
// Every arm's reader already said what it found, and that is what built the key
// (`gold.mjs`). Grading is therefore comparing two short strings per arm per question,
// which the SimpleQA protocol does in one cheap call: CORRECT, INCORRECT, NOT_ATTEMPTED.
//
// Two quality columns are reported side by side. Against APRIL's key, which is what a
// naive run of this benchmark produces, and against TODAY's, built by the field. The
// gap between them is not noise: it is what the staleness of a frozen answer key costs
// each engine, and it is largest for the engines that are most up to date.
//
// Usage: node bin/score.mjs [--run=runs/<date>]
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';

const BENCH = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const RUN = `${BENCH}${RUNREL}/`;
const GRADER = arg('grader', 'openai/gpt-5.6-luna');
// a suffix keeps two answer keys side by side: nothing written here can overwrite the
// grades or the results produced against the other one
const TAG = arg('tag', '');
const GOLDF = arg('gold', 'gold-today.json');
const OUT = `${RUN}scoreboard${TAG}.json`;

const env = Object.fromEntries(readFileSync(`${BENCH}.env`, 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

const ask = async (prompt) => {
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: GRADER, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(120000),
      });
      const j = await r.json();
      if (j.error) { await new Promise((s) => setTimeout(s, 2000 * (a + 1))); continue; }
      return String(j.choices?.[0]?.message?.content ?? '').trim();
    } catch { await new Promise((s) => setTimeout(s, 2000 * (a + 1))); }
  }
  return '';
};

const gold = JSON.parse(readFileSync(`${RUN}${GOLDF}`, 'utf8'));
const arms = readdirSync(`${RUN}raw`).filter((a) => !a.startsWith('.')).sort();
const rows = Object.entries(gold);
console.log(`${rows.length} questions, ${arms.length} arms\n`);

// the SimpleQA protocol, on two short strings
const grade = async (question, answer, target) => {
  // RIEN is the sentinel runs before 2026-08-07 recorded; NOTHING is the current one
  if (!answer || /^(NOTHING|RIEN)$/i.test(answer)) return 'NOT_ATTEMPTED';
  const t = await ask(`Grade a predicted answer against the correct answer.

QUESTION: ${question}
CORRECT ANSWER: ${target}
PREDICTED ANSWER: ${answer}

CORRECT if the prediction contains the correct answer, allowing differences of wording, precision, spelling or format. INCORRECT if it states something that contradicts it. NOT_ATTEMPTED if it declines or does not answer.

Reply with one word: CORRECT, INCORRECT or NOT_ATTEMPTED.`);
  return (t.match(/\b(CORRECT|INCORRECT|NOT_ATTEMPTED)\b/i) || [, 'NOT_ATTEMPTED'])[1].toUpperCase();
};

const res = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
let done = 0;
for (const [row, g] of rows) {
  // An arm added after the run was scored has no grades on rows that already have
  // some. Skipping the whole row would leave it permanently ungraded, so only the
  // arms missing from a row are judged: nothing already paid for is re-judged, and
  // nothing new is left out.
  const rec = res[row] || {};
  const todo = arms.filter((a) => rec[a] === undefined);
  if (!todo.length) { done++; continue; }
  await Promise.all(todo.map(async (arm) => {
    const said = g.said?.[arm] || 'NOTHING';
    rec[arm] = {
      today: g.gold_today ? await grade(g.question, said, g.gold_today) : null,
      april: await grade(g.question, said, g.gold_freshqa),
    };
  }));
  res[row] = rec;
  if (++done % 10 === 0) { writeFileSync(OUT, JSON.stringify(res, null, 1)); console.log(`  ${done}/${rows.length}`); }
}
writeFileSync(OUT, JSON.stringify(res, null, 1));

// TOKENS AS BILLED, not as guessed. `tokens.mjs` sends every payload once and records
// the prompt_tokens the call was actually charged. The harness's own collect.json
// records bytes, which is a different thing entirely, and dividing a file size by four
// estimates a number we can simply ask for.
let estimated = false;
const measured = (() => {
  try { return JSON.parse(readFileSync(`${RUN}tokens.json`, 'utf8')); } catch { return null; }
})();
const readerTokens = (arm) => {
  if (measured && typeof measured[arm] === 'number') return measured[arm];
  estimated = true;
  let n = 0, c = 0;
  for (const f of readdirSync(`${RUN}raw/${arm}`)) {
    if (!f.endsWith('.json')) continue;
    n += statSync(`${RUN}raw/${arm}/${f}`).size; c++;
  }
  return c ? Math.round(n / c / 4) : 0;
};

// THE COLUMN IS PRICED ON THE MODEL THAT ANSWERS, NOT ON OURS. Those tokens were
// counted by the reader's tokenizer, which is our expense; the buyer feeds a different
// model and is charged a different count for the same bytes. `reprice.mjs` measures
// that ratio per arm on real payloads. Without it the run still reports, and says so.
const reprice = (() => {
  try { return JSON.parse(readFileSync(`${RUN}reprice.json`, 'utf8')); } catch { return null; }
})();
const pricing = JSON.parse(readFileSync(`${BENCH}pricing.json`, 'utf8'));
const ANSWERER = reprice?.model || 'anthropic/claude-sonnet-5';
const LLM_USD_MTOK = pricing.llms[ANSWERER]?.usd_per_mtok_input;
if (!LLM_USD_MTOK) throw new Error(`no input price for ${ANSWERER} in pricing.json`);

const decided = rows.filter(([, g]) => g.gold_today).map(([r]) => r);
console.log(`\n${decided.length} questions kept (answer of the day established), ${rows.length - decided.length} dropped\n`);

const armPrice = (arm) => {
  const p = pricing.arms[arm];
  // A MISSING PRICE IS NOT A FREE ARM. Reading the absent field as zero is what once
  // published Firecrawl at $0.00 and put it at the top of a cost ranking.
  if (!p) return { usd: null, why: 'not in pricing.json' };
  if (typeof p.usd_per_1k_requests === 'number') return { usd: p.usd_per_1k_requests, why: p.billing };
  // Subscription arms publish no per-request rate. The repo's rule is the cheapest paid
  // plan consumed in full, which is the most favourable reading for the vendor.
  if (p.billing === 'subscription' && p.units_per_month) {
    return { usd: (p.usd_per_month / (p.units_per_month / (p.units_per_request || 1))) * 1000, why: 'subscription consumed in full' };
  }
  return { usd: null, why: 'no rate published and no plan to derive one from' };
};

const table = [];
for (const arm of arms) {
  const correct = decided.filter((r) => res[r]?.[arm]?.today === 'CORRECT').length;
  const april = rows.filter(([r]) => res[r]?.[arm]?.april === 'CORRECT').length;
  const tkReader = readerTokens(arm);
  const ratio = reprice?.arms?.[arm]?.ratio ?? null;
  const tk = ratio ? Math.round(tkReader * ratio) : tkReader;
  const { usd: api, why } = armPrice(arm);
  const llm = (tk * 1000 * LLM_USD_MTOK) / 1e6;
  const total = api == null ? null : api + llm;
  const rate = decided.length ? correct / decided.length : 0;
  table.push({
    arm, vendor: arm.split('-')[0], correct, april, rate: Math.round(100 * rate),
    tkReader, ratio, tk, api, why, llm, total,
    perCorrect: total == null || !rate ? null : total / (1000 * rate),
  });
}
table.sort((x, y) => (x.total ?? Infinity) - (y.total ?? Infinity));

const usd = (v, d = 2) => (v == null ? '?' : `$${v.toFixed(d)}`);
console.log('  arm                   today   april   delta   tokens    api/1k    llm/1k  total/1k   $/correct');
for (const r of table) {
  console.log(`  ${r.arm.padEnd(20)} ${String(r.rate + '%').padStart(6)}  ${String(r.april + '%').padStart(6)}  ${String((r.rate - r.april >= 0 ? '+' : '') + (r.rate - r.april)).padStart(6)}  ${String(r.tk).padStart(7)}  ${usd(r.api).padStart(8)}  ${usd(r.llm).padStart(8)}  ${usd(r.total).padStart(8)}   ${usd(r.perCorrect, 4).padStart(9)}`);
}

const meta = (() => { try { return JSON.parse(readFileSync(`${RUN}gold-meta.json`, 'utf8')); } catch { return {}; } })();
const qmeta = (() => { try { return JSON.parse(readFileSync(`${RUN}questions.json`, 'utf8')); } catch { return {}; } })();

const results = {
  n: decided.length,
  date: new Date().toISOString().slice(0, 10),
  dataset: qmeta.source || 'FreshQA (Google)',
  seed: qmeta.seed ?? null,
  gold: 'consensus of the field, established on the day of the run',
  reader: meta.reader ?? null,
  arbiter: meta.arbiter ?? null,
  grader: GRADER,
  voters: meta.voters ?? null,
  answering_model: { model: ANSWERER, usd_per_mtok_input: LLM_USD_MTOK },
  token_note: reprice
    ? `tokens_per_query is counted by ${ANSWERER}: measured on the reader's tokenizer, then converted per arm by the ratio in reprice.json`
    : `tokens_per_query is counted by the reader's tokenizer; run bin/reprice.mjs to convert it to ${ANSWERER}`,
  arms: table.map((r) => ({
    arm: r.arm, vendor: r.vendor,
    api_usd_per_1k: r.api,
    api_basis: r.why,
    tokens_per_query: r.tk,
    tokens_per_query_reader: r.tkReader,
    reprice_ratio: r.ratio,
    llm_usd_per_1k: r.llm == null ? null : Number(r.llm.toFixed(4)),
    total_usd_per_1k: r.total == null ? null : Number(r.total.toFixed(4)),
    correct: r.correct,
    correct_rate: r.rate,
    correct_rate_april: r.april,
    usd_per_correct: r.perCorrect == null ? null : Number(r.perCorrect.toFixed(6)),
  })),
};
writeFileSync(`${RUN}results${TAG}.json`, `${JSON.stringify(results, null, 2)}\n`);

console.log(`\n  results${TAG}.json written — table: node bin/table.mjs --run=${RUNREL}`);
console.log(`\n  "today" = the key the ${meta.voters?.length ?? arms.length} voting systems established on the day of the run`);
console.log(`  "april" = the FreshQA key of 2026-04-21, frozen since`);
console.log(`  the delta is what the staleness of that key costs each engine`);
if (!reprice) console.log(`\n  NOTE: tokens are the reader's count, not ${ANSWERER}'s. Run bin/reprice.mjs.`);
if (estimated) console.log(`\n  WARNING: tokens estimated from payload size, no billed count on disk`);
if (table.some((r) => r.api == null)) console.log(`\n  WARNING: arms with no published price are unranked, not free`);
