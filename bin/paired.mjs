// The paired test the run was already collecting data for.
//
// Every arm answered the SAME questions, so comparing two percentages throws away
// what the design bought. Question by question, the ones both arms get right and the
// ones both get wrong carry no information about which is better; only the
// disagreements do. McNemar's exact test reads those two counts.
//
// This costs nothing: it is arithmetic over scoreboard.json, which is already on disk.
// No model is called, so anyone can rerun it and get the same numbers.
//
// Usage: node bin/paired.mjs [--run=runs/<date>] [--alpha=0.05]
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const RUN = `${ROOT}${RUNREL}/`;
const ALPHA = parseFloat(arg('alpha', 0.05));

const sb = JSON.parse(readFileSync(`${RUN}scoreboard.json`, 'utf8'));
const results = JSON.parse(readFileSync(`${RUN}results.json`, 'utf8'));
const cost = Object.fromEntries(results.arms.map((a) => [a.arm, a.total_usd_per_1k]));
const rows = Object.keys(sb);
const ok = (r, a) => sb[r][a] && sb[r][a].today === 'CORRECT';
const score = (a) => rows.filter((r) => ok(r, a)).length;
const arms = Object.keys(sb[rows[0]]).sort((x, y) => score(y) - score(x));

// Exact binomial two-sided: with b + c disagreements, how surprising is a b vs c split
// if each disagreement were a coin flip? No normal approximation, the counts are small.
const choose = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return r; };
const pExact = (b, c) => {
  const n = b + c;
  if (!n) return 1;
  let s = 0;
  for (let i = 0; i <= Math.min(b, c); i++) s += choose(n, i);
  return Math.min(1, (2 * s) / 2 ** n);
};

const pairs = [];
for (let i = 0; i < arms.length; i++) {
  for (let j = i + 1; j < arms.length; j++) {
    const A = arms[i], B = arms[j];
    const b = rows.filter((r) => ok(r, A) && !ok(r, B)).length;
    const c = rows.filter((r) => !ok(r, A) && ok(r, B)).length;
    pairs.push({ a: A, b: B, aWins: b, bWins: c, p: pExact(b, c), gap: score(A) - score(B), extra: cost[A] - cost[B] });
  }
}
const sig = pairs.filter((x) => x.p < ALPHA);

writeFileSync(`${RUN}paired.json`, `${JSON.stringify({
  n: rows.length, alpha: ALPHA,
  note: 'McNemar exact on the questions where two arms disagree. b = first arm right and second wrong, c = the reverse.',
  scores: Object.fromEntries(arms.map((a) => [a, score(a)])),
  pairs,
}, null, 1)}\n`);

const f = (x) => x.toFixed(3);
const md = [
  `# Paired comparison, ${RUNREL}`,
  '',
  `Every arm answered the same ${rows.length} questions, so the two percentages are not`,
  'independent samples. Question by question, the ones both arms get right and the ones',
  'both get wrong say nothing about which is better. Only the disagreements do, and',
  "McNemar's exact test reads them.",
  '',
  `**${sig.length} of ${pairs.length} pairs separate at p < ${ALPHA}.**`,
  '',
  '"Not separated" is not "equal": at this sample size the test cannot settle small',
  'gaps. It can only say which gaps the data supports.',
  '',
  '## Every pair',
  '',
  '| A | B | A % | B % | A right, B wrong | B right, A wrong | p | separated |',
  '|---|---|---:|---:|---:|---:|---:|:-:|',
  ...pairs.map((x) => `| \`${x.a}\` | \`${x.b}\` | ${score(x.a)} | ${score(x.b)} | ${x.aWins} | ${x.bWins} | ${f(x.p)} | ${x.p < ALPHA ? 'yes' : 'no'} |`),
  '',
  'Regenerate with `node bin/paired.mjs --run=' + RUNREL + '`. It calls no model.',
  '',
].join('\n');
writeFileSync(`${RUN}paired.md`, md);

console.log(`${sig.length}/${pairs.length} pairs separate at p<${ALPHA}`);
console.log(`written: ${RUNREL}/paired.json and ${RUNREL}/paired.md`);
