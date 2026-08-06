// A gold answer that is dated today, built by the field itself.
//
// FreshQA's answers were last republished on 2026-04-21 and the announced May update
// never came. On the published hundred, THIRTEEN of the answers are simply out of date:
// Peru elected a different president, the UK prime minister changed, the NFL season
// turned over. The payloads carry the current truth and the benchmark scores them wrong
// for it, to the tune of eight to eighteen points on every arm. A time-sensitive
// benchmark with a frozen answer key measures how old your index is, not how good it is.
//
// There is no neutral referee to ask — checking a fresh fact requires a search engine,
// which is the thing under test. So the referee is the field: every arm answers, and
// the answer they converge on is the answer of the day.
//
// Three properties make this fair rather than circular:
//   the READER sees one payload at a time and never sees the recorded answer, so it
//     cannot recite a gold it was not given, only report what the page says;
//   the gold is built from every arm equally, so no competitor is the judge;
//   a question with no clear majority is DROPPED, not decided — disagreement is
//     reported, never resolved by force.
//
// Usage: node bin/gold.mjs --run=runs/<date> --voters=a,b,c [--model=openai/gpt-5.6-luna-pro]
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const BENCH = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUN = `${BENCH}${arg('run', 'runs/2026-08-06')}/`;
const READER = arg('reader', 'openai/gpt-5.6-luna');
// Measured on seventeen real judgements: the reasoning model costs 5.7x, because it
// re-reads its own context at every step, and it changed one verdict in seventeen —
// correctly. So it is worth its price exactly where a single error contaminates the
// answer key for every competitor, and nowhere else. Reader on Luna, arbiter on Pro.
const ARBITER = arg('model', 'openai/gpt-5.6-luna-pro');
const OUT = arg('out', `${RUN}gold-today.json`);
// The abstention sentinel. Runs collected before 2026-08-07 recorded it as RIEN; the
// grader accepts both so those runs still score, and nothing already paid for is
// reissued to change a word.
const NOTHING = 'NOTHING';

const env = Object.fromEntries(readFileSync(`${BENCH}.env`, 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

const ask = async (model, prompt) => {
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(180000),
      });
      const j = await r.json();
      if (j.error) { await new Promise((s) => setTimeout(s, 2500 * (a + 1))); continue; }
      return { text: String(j.choices?.[0]?.message?.content ?? '').trim(), tok: (j.usage?.prompt_tokens ?? 0) + (j.usage?.completion_tokens ?? 0) };
    } catch { await new Promise((s) => setTimeout(s, 2500 * (a + 1))); }
  }
  return { text: '', tok: 0 };
};

const questions = (() => { const q = JSON.parse(readFileSync(`${RUN}questions.json`, 'utf8')); return q.questions || q; })();
const arms = readdirSync(`${RUN}raw`).filter((a) => !a.startsWith('.'));
// ONE VOICE PER PROVIDER. A vendor selling three tiers would otherwise cast three
// votes, and the maintainer of this benchmark sells three — which is exactly the
// objection a reader should raise. Only the most advanced configuration of each
// provider votes; every arm is still read, and still scored, against what they decide.
const VOTERS = arg('voters', '') ? arg('voters', '').split(',') : arms;
if (!arg('voters', '')) {
  const byVendor = {};
  for (const a of arms) (byVendor[a.split('-')[0]] ||= []).push(a);
  const stacked = Object.entries(byVendor).filter(([, v]) => v.length > 1);
  if (stacked.length) {
    console.warn(`WARNING: no --voters given, so all ${arms.length} arms vote and these vendors cast more than one:`);
    for (const [v, a] of stacked) console.warn(`  ${v}: ${a.join(', ')}`);
    console.warn('Pass --voters with one arm per vendor. The electorate is recorded in gold-meta.json either way.\n');
  }
}
// Reading a payload costs money and the answers do not change when the electorate
// does, so a previous run's readings are reused when one is offered.
const PRIOR = (() => {
  try { return JSON.parse(readFileSync(`${RUN}${arg('reuse', 'gold-today.json')}`, 'utf8')); } catch { return {}; }
})();
console.log(`${questions.length} questions, ${arms.length} arms, ${VOTERS.length} voters\n`);

// WHO VOTED IS PART OF THE RESULT. The electorate arrives as a command-line argument
// and would otherwise leave no trace in the run, which puts the answer to "is this
// rigged" outside the artifacts. It is written next to the key it produced.
writeFileSync(`${RUN}gold-meta.json`, `${JSON.stringify({
  built: new Date().toISOString().slice(0, 10),
  reader: READER, arbiter: ARBITER,
  voters: VOTERS, read_but_not_voting: arms.filter((a) => !VOTERS.includes(a)),
  rule: 'one voice per provider, its most advanced configuration; every arm is read and scored, only the electorate is capped',
}, null, 1)}\n`);

// the payload of one arm for one question, verbatim, minus the vendor's own synthesis
const payloadOf = (arm, row) => {
  const f = `${RUN}raw/${arm}/${row}.json`;
  if (!existsSync(f)) return '';
  let d;
  try { d = JSON.parse(readFileSync(f, 'utf8')); } catch { return ''; }
  const raw = d.raw ?? d;
  const s = JSON.stringify(raw);
  return s.length > 60000 ? s.slice(0, 60000) : s;
};

const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
let tokR = 0, tokA = 0, done = 0;
for (const q of questions) {
  if (out[q.row]) { done++; continue; }
  // STEP 1 — one reader per payload, alone, never shown the recorded answer
  const said = { ...(PRIOR[q.row]?.said || {}) };
  await Promise.all(arms.filter((arm) => said[arm] === undefined).map(async (arm) => {
    const p = payloadOf(arm, q.row);
    if (!p) { said[arm] = NOTHING; return; }
    const r = await ask(READER, `Answer the question using ONLY the search results below. Reply with the answer in at most twelve words and nothing else. If the results do not settle it, reply exactly: NOTHING.

QUESTION: ${q.question}

SEARCH RESULTS:
${p}`);
    tokR += r.tok;
    said[arm] = r.text || NOTHING;
  }));

  // STEP 2 — the field decides. The arbiter sees the answers, not the payloads, and
  // is told it may refuse.
  const lines = VOTERS.map((a) => `${a}: ${said[a] ?? NOTHING}`).join('\n');
  const r2 = await ask(ARBITER, `A question was put to ${VOTERS.length} independent web-search systems today. Each read its own search results and reported what it found. Here is what each said.

QUESTION: ${q.question}

ANSWERS:
${lines}

Decide today's correct answer from these reports alone.

Rules:
- Answers that differ only in wording, precision or format count as agreeing.
- "NOTHING" means that system found nothing; it is not a vote for or against anything.
- If the systems genuinely disagree about the FACT, or if fewer than half of those that answered agree, do not pick a winner.

Reply on three lines, nothing else:
ANSWER: the answer, or NONE if there is no clear majority
AGREE: how many systems support it, out of how many answered, like 8/11
WHY: one short sentence`);
  tokA += r2.tok;
  const t = r2.text;
  const answer = (t.match(/ANSWER:\s*(.*)/i) || [, ''])[1].trim();
  const agree = (t.match(/AGREE:\s*(\S+)/i) || [, ''])[1].trim();
  const why = (t.match(/WHY:\s*(.*)/i) || [, ''])[1].trim();
  const [sup, tot] = (agree.match(/(\d+)\s*\/\s*(\d+)/) || [, 0, 0]).slice(1).map(Number);
  out[q.row] = {
    question: q.question, gold_freshqa: q.gold, gold_today: answer && !/^NONE$/i.test(answer) ? answer : null,
    agree: agree, support: sup, answered: tot, why, said,
  };
  if (++done % 10 === 0) { writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log(`  ${done}/${questions.length}  —  about $${(tokR / 1e6 * 0.15 + tokA / 1e6 * 0.7).toFixed(2)}`); }
}
writeFileSync(OUT, JSON.stringify(out, null, 1));

const v = Object.values(out);
const decided = v.filter((x) => x.gold_today);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const changed = decided.filter((x) => !String(x.gold_freshqa || '').split('|').some((g) => norm(g) && norm(x.gold_today).includes(norm(g))));
console.log(`\n${decided.length}/${v.length} questions settled by the field`);
console.log(`  ${v.length - decided.length} dropped for want of agreement`);
console.log(`  ${changed.length} whose answer has CHANGED since the April key\n`);
for (const x of changed.slice(0, 20)) {
  console.log(`  ${x.question.slice(0, 58)}`);
  console.log(`     april  ${String(x.gold_freshqa).split('|')[0].slice(0, 50)}`);
  console.log(`     today  ${String(x.gold_today).slice(0, 50)}   (${x.agree})`);
}
console.log(`\ncost: about $${(tokR / 1e6 * 0.15 + tokA / 1e6 * 0.7).toFixed(2)}  —  written to ${OUT}`);
