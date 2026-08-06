// Reprice the token column on the model that actually answers.
//
// The run counts tokens with the reader's tokenizer, because the reader is the model
// that reads every payload. That is our expense, not the buyer's. The number a buyer
// needs is what the payload costs to feed the model they answer with, and this
// benchmark names Sonnet 5 for that.
//
// Token counts are tokenizer-specific, so repricing is not a multiplication by a price
// ratio: the COUNT changes too. There is no public Anthropic tokenizer, so the count is
// obtained the only honest way available. Real payloads are sent to both models with a
// one-token cap, and the ratio each arm shows is applied to that arm. A ratio per arm,
// not one global ratio, because a JSON envelope thick with punctuation and a page of
// prose do not tokenize alike.
//
// Sampling rather than retokenising everything is a cost decision, stated rather than
// hidden: the full corpus is about 14M tokens, which is $42 at Sonnet's input rate.
// Thirty-nine payloads cost about a dollar, and the ratio is stable enough that the
// spread within an arm is published next to it.
//
// Usage: node bin/reprice.mjs [--run=runs/<date>] [--sample=3]
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const RUN = `${ROOT}${RUNREL}/`;
const SAMPLE = parseInt(arg('sample', 3), 10);
const READER = arg('reader', 'openai/gpt-5.6-luna');
const TARGET = arg('model', 'anthropic/claude-sonnet-5');

const env = Object.fromEntries(readFileSync(`${ROOT}.env`, 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

const pricing = JSON.parse(readFileSync(`${ROOT}pricing.json`, 'utf8'));
if (!pricing.llms[TARGET]?.usd_per_mtok_input) throw new Error(`no price for ${TARGET} in pricing.json`);

// prompt_tokens for one payload, from the model itself. max_tokens 1 so the completion
// costs nothing worth counting.
const countWith = async (model, text) => {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: text }] }),
        signal: AbortSignal.timeout(180000),
      });
      const j = await r.json();
      if (j.error) { if (a === 3) return null; await new Promise((s) => setTimeout(s, 3000 * (a + 1))); continue; }
      return j.usage?.prompt_tokens ?? null;
    } catch { if (a === 3) return null; await new Promise((s) => setTimeout(s, 3000 * (a + 1))); }
  }
  return null;
};

const questions = (() => { const q = JSON.parse(readFileSync(`${RUN}questions.json`, 'utf8')); return q.questions || q; })();
const arms = readdirSync(`${RUN}raw`).filter((a) => !a.startsWith('.')).sort();
console.log(`${arms.length} arms, ${SAMPLE} payloads each, ${READER} against ${TARGET}\n`);

const prompt = (q, payload) => `Answer the question using only the search results.\n\nQUESTION: ${q}\n\nSEARCH RESULTS:\n${payload}`;

const out = existsSync(`${RUN}reprice.json`) ? JSON.parse(readFileSync(`${RUN}reprice.json`, 'utf8')) : { model: TARGET, reader: READER, sample: SAMPLE, arms: {} };
for (const arm of arms) {
  if (out.arms[arm]) continue;
  // spread the sample across the size range rather than taking the first three: an arm
  // whose payloads vary by an order of magnitude would otherwise be measured on one end
  const rows = questions
    .map((q) => ({ q, f: `${RUN}raw/${arm}/${q.row}.json` }))
    .filter((x) => existsSync(x.f))
    .map((x) => ({ ...x, size: statSync(x.f).size }))
    .sort((a, b) => a.size - b.size);
  if (!rows.length) { console.log(`  ${arm.padEnd(20)} no payload on disk`); continue; }
  const pick = [...new Set([0, Math.floor(rows.length / 2), rows.length - 1].slice(0, SAMPLE))].map((i) => rows[i]);

  const pairs = [];
  for (const p of pick) {
    let d; try { d = JSON.parse(readFileSync(p.f, 'utf8')); } catch { continue; }
    const text = prompt(p.q.question, JSON.stringify(d.raw ?? d));
    const a = await countWith(READER, text);
    const b = await countWith(TARGET, text);
    if (a && b) pairs.push({ row: p.q.row, reader: a, target: b, ratio: b / a });
  }
  if (!pairs.length) { console.log(`  ${arm.padEnd(20)} measurement failed`); continue; }
  const sr = pairs.reduce((s, p) => s + p.reader, 0);
  const st = pairs.reduce((s, p) => s + p.target, 0);
  const lo = Math.min(...pairs.map((p) => p.ratio));
  const hi = Math.max(...pairs.map((p) => p.ratio));
  out.arms[arm] = { ratio: st / sr, spread: [lo, hi], pairs };
  writeFileSync(`${RUN}reprice.json`, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`  ${arm.padEnd(20)} ${String(sr).padStart(7)} -> ${String(st).padStart(7)}   ratio ${(st / sr).toFixed(3)}   spread ${lo.toFixed(3)}-${hi.toFixed(3)}`);
}

const all = Object.values(out.arms);
if (all.length) {
  const mean = all.reduce((s, a) => s + a.ratio, 0) / all.length;
  console.log(`\nmean ratio ${mean.toFixed(3)} across ${all.length} arms, ${Math.min(...all.map((a) => a.ratio)).toFixed(3)} to ${Math.max(...all.map((a) => a.ratio)).toFixed(3)}`);
}
console.log(`written to ${RUNREL}/reprice.json`);
