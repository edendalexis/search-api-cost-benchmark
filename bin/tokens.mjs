// Tokens as billed, measured rather than guessed.
//
// The harness records prompt_tokens during its answering phase; we skipped that phase
// because it grades against an answer key we no longer trust. So the number is taken
// directly: each payload is sent once, with the answering prompt template and a
// one-token cap, and what comes back is what a customer's model would be charged to
// read it. Dividing a file size by four is an estimate of a number we can simply ask for.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
const BENCH = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUN = `${BENCH}${arg('run', 'runs/2026-08-06')}/`;
const OUT = `${RUN}tokens.json`;
const env = Object.fromEntries(readFileSync(`${BENCH}.env`, 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const questions = (() => { const q = JSON.parse(readFileSync(`${RUN}questions.json`, 'utf8')); return q.questions || q; })();
const arms = readdirSync(`${RUN}raw`).filter((a) => !a.startsWith('.')).sort();
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
let done = 0;
for (const arm of arms) {
  if (out[arm]) { done++; continue; }
  const vals = [];
  await Promise.all(questions.map(async (q) => {
    const f = `${RUN}raw/${arm}/${q.row}.json`;
    if (!existsSync(f)) return;
    let d; try { d = JSON.parse(readFileSync(f, 'utf8')); } catch { return; }
    const payload = JSON.stringify(d.raw ?? d);
    for (let a = 0; a < 4; a++) {
      try {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST', headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'openai/gpt-5.6-luna', max_tokens: 1, temperature: 0,
            messages: [{ role: 'user', content: `Answer the question using only the search results.\n\nQUESTION: ${q.question}\n\nSEARCH RESULTS:\n${payload}` }] }),
          signal: AbortSignal.timeout(120000) });
        const j = await r.json();
        if (j.error) { await new Promise((s) => setTimeout(s, 2000 * (a + 1))); continue; }
        if (j.usage?.prompt_tokens) vals.push(j.usage.prompt_tokens);
        return;
      } catch { await new Promise((s) => setTimeout(s, 2000 * (a + 1))); }
    }
  }));
  out[arm] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`  ${arm.padEnd(20)} ${out[arm]} tokens per query   (${vals.length} measurements)`);
}
console.log(`\nwritten to ${OUT}`);
