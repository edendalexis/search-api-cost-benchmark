// Adds one arm's readings to an answer key that already exists.
//
// gold.mjs builds the key and skips any question it has already settled, which is
// correct: a key established by a fixed electorate must not move because a new arm
// showed up. But a new arm still has to be READ before it can be scored, so this fills
// in `said[arm]` for a single arm and touches nothing else. The key itself, the vote
// and the electorate are left exactly as they were.
//
// Usage: node bin/read-arm.mjs --run=runs/<date> --arm=<name>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUN = `${ROOT}${arg('run', '')}/`;
const ARM = arg('arm', '');
const READER = arg('reader', 'openai/gpt-5.6-luna');
if (!ARM) throw new Error('--arm is required');

const env = Object.fromEntries(readFileSync(`${ROOT}.env`, 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

const ask = async (prompt) => {
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: READER, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(180000),
      });
      const j = await r.json();
      if (j.error) { await new Promise((s) => setTimeout(s, 2500 * (a + 1))); continue; }
      return String(j.choices?.[0]?.message?.content ?? '').trim();
    } catch { await new Promise((s) => setTimeout(s, 2500 * (a + 1))); }
  }
  return '';
};

const gold = JSON.parse(readFileSync(`${RUN}gold-today.json`, 'utf8'));
const rows = Object.entries(gold);
let done = 0, read = 0;
for (const [row, g] of rows) {
  if (g.said && g.said[ARM] !== undefined) { done++; continue; }
  const f = `${RUN}raw/${ARM}/${row}.json`;
  if (!existsSync(f)) { (g.said ||= {})[ARM] = 'NOTHING'; continue; }
  let d; try { d = JSON.parse(readFileSync(f, 'utf8')); } catch { (g.said ||= {})[ARM] = 'NOTHING'; continue; }
  const payload = JSON.stringify(d.raw ?? d).slice(0, 60000);
  const t = await ask(`Answer the question using ONLY the search results below. Reply with the answer in at most twelve words and nothing else. If the results do not settle it, reply exactly: NOTHING.

QUESTION: ${g.question}

SEARCH RESULTS:
${payload}`);
  (g.said ||= {})[ARM] = t || 'NOTHING';
  if (++read % 10 === 0) { writeFileSync(`${RUN}gold-today.json`, JSON.stringify(gold, null, 1)); console.log(`  ${read} read`); }
}
writeFileSync(`${RUN}gold-today.json`, JSON.stringify(gold, null, 1));
console.log(`${read} newly read, ${done} already present, ${rows.length} questions total`);
