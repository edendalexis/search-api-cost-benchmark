// Turns a run into the published table: a markdown table for the README, and a chart.
//
// Reads only what the run wrote, so every number here is recomputable on your own
// machine, offline, without a key.
//
// The chart is emitted as static SVG rather than screenshotted from a browser. It has
// to survive being rendered by GitHub, which strips scripts and loads no fonts, so
// nothing here measures text at render time: label placement uses a conservative width
// estimate and falls outside the bar whenever the fit is not certain. Two files are
// written, one per theme, and the README picks between them with <picture>.
//
// Usage: node bin/table.mjs [--run=runs/<date>] [--sort=cost|quality]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const SORT = arg('sort', 'cost');
const R = JSON.parse(readFileSync(`${ROOT}${RUNREL}/results.json`, 'utf8'));

const arms = [...R.arms].filter((a) => a.total_usd_per_1k != null);
const unpriced = R.arms.filter((a) => a.total_usd_per_1k == null);
arms.sort(SORT === 'quality'
  ? (a, b) => b.correct_rate - a.correct_rate || a.total_usd_per_1k - b.total_usd_per_1k
  : (a, b) => a.total_usd_per_1k - b.total_usd_per_1k);

const label = (a) => a.arm;
const usd = (v, d = 2) => `$${v.toFixed(d)}`;
const num = (v) => v.toLocaleString('en-US');
// An arm whose price at the door is zero is a real priced configuration, not an
// omission, but it is the maintainer's own and it sorts first on cost. It is marked
// rather than quietly ranked, and the mark is explained under the table.
const isFree = (a) => a.api_usd_per_1k === 0;

/* ---------------------------------------------------------------- markdown ---- */

const md = () => {
  const head = `| # | Provider | API $/1k | Tokens / query | LLM $/1k | **Total $/1k** | Correct | $ / correct answer |\n|---:|---|---:|---:|---:|---:|---:|---:|`;
  const body = arms.map((a, i) => `| ${i + 1} | \`${label(a)}\`${isFree(a) ? ' †' : ''} | ${usd(a.api_usd_per_1k)} | ${num(a.tokens_per_query)} | ${usd(a.llm_usd_per_1k)} | **${usd(a.total_usd_per_1k)}** | ${a.correct_rate}% | ${usd(a.usd_per_correct, 4)} |`);
  const foot = unpriced.length
    ? `\n\n${unpriced.map((a) => `\`${label(a)}\` is unranked: ${a.api_basis}. Unranked is not free.`).join('  \n')}`
    : '';
  const free = arms.some(isFree)
    ? `\n\n† Costs zero at the door on every plan of its vendor, free or paid. That is its list price, not a promotion, and the token column still applies.`
    : '';
  return `${head}\n${body.join('\n')}${free}${foot}`;
};

/* --------------------------------------------------------------------- svg ---- */

const THEMES = {
  dark: { ground: '#0b0f11', alt: '#111819', line: '#1e2a30', ink: '#e8f0f2', dim: '#8aa0a7', faint: '#55686e', api: '#4a6b78', tok: '#d96f4c', hot: '#e8503a', good: '#35d6a4' },
  light: { ground: '#ffffff', alt: '#f6f8f8', line: '#dfe6e8', ink: '#0b1416', dim: '#5a6f76', faint: '#80959c', api: '#3d5f6c', tok: '#c85a36', hot: '#d63b22', good: '#0f9b72' },
};

const W = 960, ROW = 34, HEAD = 62, PAD = 20;
const TRACK_X = 222, TRACK_W = 436;
const X_TOK = 792, X_TOTAL = 878, X_CORRECT = 952;
const CAP = 60;                       // dollars; anything past this is drawn clipped
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// conservative monospace advance: real faces sit near 0.60em, 0.63 leaves room so a
// label never overflows the segment it was placed inside
const textW = (s, size) => s.length * size * 0.63;

const svg = (t) => {
  const H = HEAD + arms.length * ROW + (arms.some(isFree) ? 70 : 54);
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">`);
  o.push(`<rect width="${W}" height="${H}" fill="${t.ground}"/>`);

  // legend
  const leg = [[t.api, 'request'], [t.tok, `tokens, read on ${R.answering_model.model.split('/')[1]} at $${R.answering_model.usd_per_mtok_input}/M`], [t.good, 'answers graded correct']];
  let lx = PAD;
  for (const [c, s] of leg) {
    o.push(`<rect x="${lx}" y="14" width="18" height="8" rx="1" fill="${c}"/>`);
    o.push(`<text x="${lx + 24}" y="22" font-size="10.5" fill="${t.faint}" letter-spacing="0.6">${esc(s)}</text>`);
    lx += 24 + textW(s, 10.5) + 26;
  }
  o.push(`<text x="${W - PAD}" y="22" font-size="10.5" fill="${t.faint}" text-anchor="end" letter-spacing="0.6">axis capped at $${CAP}</text>`);

  // header
  const th = (x, s, anchor = 'end') => `<text x="${x}" y="${HEAD - 12}" font-size="9.5" fill="${t.faint}" text-anchor="${anchor}" letter-spacing="1.3">${esc(s.toUpperCase())}</text>`;
  o.push(th(PAD, 'Provider', 'start'));
  o.push(th(TRACK_X, 'Cost of 1,000 queries', 'start'));
  o.push(th(X_TOK, 'Tok / query'));
  o.push(th(X_TOTAL, 'Total / 1k'));
  o.push(th(X_CORRECT, 'Correct'));
  o.push(`<line x1="${PAD}" y1="${HEAD - 6}" x2="${W - PAD}" y2="${HEAD - 6}" stroke="${t.line}"/>`);

  arms.forEach((a, i) => {
    const y = HEAD + i * ROW;
    if (i % 2) o.push(`<rect x="0" y="${y}" width="${W}" height="${ROW}" fill="${t.alt}"/>`);
    o.push(`<line x1="${PAD}" y1="${y + ROW}" x2="${W - PAD}" y2="${y + ROW}" stroke="${t.line}" stroke-opacity="0.55"/>`);

    const name = label(a) + (isFree(a) ? ' †' : '');
    o.push(`<text x="${PAD}" y="${y + 22}" font-size="13" fill="${t.ink}">${esc(name)}</text>`);

    // the bar: price at the door, then the tokens the payload pushes into the model
    const scale = TRACK_W / CAP;
    const apiW = Math.max(a.api_usd_per_1k * scale, a.api_usd_per_1k > 0 ? 2 : 0);
    const over = a.total_usd_per_1k > CAP;
    const tokW = Math.min(a.llm_usd_per_1k * scale, TRACK_W - apiW);
    const by = y + 9, bh = 16;
    if (apiW > 0) o.push(`<rect x="${TRACK_X}" y="${by}" width="${apiW.toFixed(1)}" height="${bh}" rx="2" fill="${t.api}"/>`);
    o.push(`<rect x="${(TRACK_X + apiW).toFixed(1)}" y="${by}" width="${tokW.toFixed(1)}" height="${bh}" rx="2" fill="${over ? t.hot : t.tok}"/>`);
    if (over) {
      o.push(`<rect x="${TRACK_X + TRACK_W - 12}" y="${by - 3}" width="14" height="${bh + 6}" fill="${t.hot}" fill-opacity="0.9"/>`);
      o.push(`<rect x="${TRACK_X + TRACK_W - 6}" y="${by - 3}" width="4" height="${bh + 6}" fill="${t.ground}"/>`);
    }

    // labels: inside the segment when the fit is certain, queued in the gutter otherwise
    const place = (text, x0, w, colour) => {
      const tw = textW(text, 11);
      if (w >= tw + 12) return `<text x="${(x0 + w / 2).toFixed(1)}" y="${y + 21}" font-size="11" font-weight="700" fill="${t.ground}" text-anchor="middle">${esc(text)}</text>`;
      return null;
    };
    // The price at the door falls BACK, never forward. Queued after the token segment
    // it reads as part of it, which is the one misreading this chart exists to prevent.
    const aLab = a.api_usd_per_1k > 0 ? usd(a.api_usd_per_1k) : null;
    const tLab = usd(a.llm_usd_per_1k);
    const inA = aLab && place(aLab, TRACK_X, apiW);
    if (inA) o.push(inA);
    else if (aLab) o.push(`<text x="${TRACK_X - 7}" y="${y + 21}" font-size="11" font-weight="700" fill="${t.api}" text-anchor="end">${esc(aLab)}</text>`);
    const inT = place(tLab, TRACK_X + apiW, tokW);
    if (inT) o.push(inT);
    else o.push(`<text x="${(TRACK_X + apiW + tokW + 7).toFixed(1)}" y="${y + 21}" font-size="11" font-weight="700" fill="${over ? t.hot : t.tok}">${esc(tLab)}</text>`);

    o.push(`<text x="${X_TOK}" y="${y + 22}" font-size="13" fill="${t.dim}" text-anchor="end">${num(a.tokens_per_query)}</text>`);
    o.push(`<text x="${X_TOTAL}" y="${y + 22}" font-size="14.5" font-weight="700" fill="${t.ink}" text-anchor="end">${usd(a.total_usd_per_1k)}</text>`);
    o.push(`<text x="${X_CORRECT - 44}" y="${y + 22}" font-size="13" font-weight="700" fill="${t.ink}" text-anchor="end">${a.correct_rate}%</text>`);
    o.push(`<rect x="${X_CORRECT - 36}" y="${y + 15}" width="36" height="4" rx="2" fill="${t.line}"/>`);
    o.push(`<rect x="${X_CORRECT - 36}" y="${y + 15}" width="${(36 * a.correct_rate / 100).toFixed(1)}" height="4" rx="2" fill="${t.good}"/>`);
  });

  const fy = HEAD + arms.length * ROW + 22;
  const foot = [
    `${R.n} questions, ${R.date}. Answer key established on the day of the run by ${R.voters ? R.voters.length : '?'} independent systems, one vote per provider.`,
    `At n=${R.n} the correct column carries about plus or minus 10 points. The cost column does not.`,
  ];
  if (arms.some(isFree)) foot.push('† costs zero at the door on every plan of its vendor, free or paid. That is its list price, and the token column still applies.');
  foot.forEach((s, i) => o.push(`<text x="${PAD}" y="${fy + i * 16}" font-size="10.5" fill="${t.faint}">${esc(s)}</text>`));
  o.push('</svg>');
  return o.join('\n');
};

/* ------------------------------------------------------------------ write ---- */

mkdirSync(`${ROOT}docs`, { recursive: true });
writeFileSync(`${ROOT}docs/table-dark.svg`, `${svg(THEMES.dark)}\n`);
writeFileSync(`${ROOT}docs/table-light.svg`, `${svg(THEMES.light)}\n`);

const table = md();
writeFileSync(`${ROOT}${RUNREL}/report.md`, `# ${RUNREL}\n\n${R.n} questions, ${R.date}, sorted by total cost.\n\n${table}\n`);

// The README carries the table itself, not a link to it. Injected between markers so
// a rebuild never touches the prose around it.
const readme = `${ROOT}README.md`;
if (existsSync(readme)) {
  const src = readFileSync(readme, 'utf8');
  const out = src.replace(/<!-- RESULTS -->[\s\S]*?<!-- \/RESULTS -->/,
    `<!-- RESULTS -->\n${table}\n<!-- /RESULTS -->`);
  if (out !== src) { writeFileSync(readme, out); console.log('README results table updated'); }
  else console.log('README has no <!-- RESULTS --> markers; table not injected');
}

console.log(`docs/table-dark.svg, docs/table-light.svg, ${RUNREL}/report.md`);
console.log(`${arms.length} arms ranked by ${SORT}${unpriced.length ? `, ${unpriced.length} unpriced and unranked` : ''}`);
