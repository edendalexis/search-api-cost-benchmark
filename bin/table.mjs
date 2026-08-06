// Turns a run into the published table: a markdown table for the README, and a chart.
//
// Reads only what the run wrote, so every number here is recomputable on your own
// machine, offline, without a key.
//
// The chart is emitted as static SVG rather than screenshotted from a browser. It has
// to survive being rendered by GitHub, which strips scripts and loads nothing from the
// network, so the brand marks are embedded from docs/marks/ and nothing measures text
// at render time: label placement uses a conservative width estimate and falls outside
// the bar whenever the fit is not certain. Two files are written, one per theme, and
// the README picks between them with <picture>.
//
// The canvas is deliberately narrower than the README column. GitHub scales an image
// down to fit and never up, so a wide sheet arrives shrunk and cramped; a narrow one
// arrives at its own size with the type still generous.
//
// Usage: node bin/table.mjs [--run=runs/<date>] [--sort=cost|quality]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const SORT = arg('sort', 'cost');
const R = JSON.parse(readFileSync(`${ROOT}${RUNREL}/results.json`, 'utf8'));

const VENDOR = {
  serpdive: 'SERPdive', parallel: 'Parallel', tavily: 'Tavily', you: 'You.com',
  firecrawl: 'Firecrawl', linkup: 'Linkup', brave: 'Brave', exa: 'Exa',
};
const DOMAIN = {
  SERPdive: 'serpdive.com', Parallel: 'parallel.ai', Tavily: 'tavily.com', 'You.com': 'you.com',
  Firecrawl: 'firecrawl.dev', Linkup: 'linkup.so', Brave: 'brave.com', Exa: 'exa.ai',
};
const HUE = {
  SERPdive: '#35d6a4', Parallel: '#8f7bf0', Tavily: '#4a9df0', 'You.com': '#e8748f',
  Firecrawl: '#e0a33c', Linkup: '#3fc7c7', Brave: '#f4813f', Exa: '#d05fd0',
};
// Cached once and committed, so a published chart never depends on a third party being
// up, and so the SVG carries no request to anyone when someone opens the README.
const mark = (domain) => {
  const f = `${ROOT}docs/marks/${domain}.png`;
  return existsSync(f) ? `data:image/png;base64,${readFileSync(f).toString('base64')}` : null;
};

const priced = R.arms.filter((a) => a.total_usd_per_1k != null);
const unpriced = R.arms.filter((a) => a.total_usd_per_1k == null);
priced.sort(SORT === 'quality'
  ? (a, b) => b.correct_rate - a.correct_rate || a.total_usd_per_1k - b.total_usd_per_1k
  : (a, b) => a.total_usd_per_1k - b.total_usd_per_1k);

const rows = priced.map((a) => {
  const vendor = VENDOR[a.vendor] || a.vendor;
  return { ...a, vendor, tier: a.arm.replace(/^[a-z]+-/, ''), domain: DOMAIN[vendor] || '', hue: HUE[vendor] || '#8aa0a7' };
});

const usd = (v, d = 2) => `$${v.toFixed(d)}`;
const num = (v) => v.toLocaleString('en-US');
// The one arm that costs nothing at the door is the maintainer's own and it sorts
// first. It is named in the footnote rather than flagged with a symbol in the column:
// a dagger next to a row reads as an asterisk on the result, which is not the claim.
const free = rows.filter((a) => a.api_usd_per_1k === 0);

/* ---------------------------------------------------------------- markdown ---- */

const md = () => {
  const head = `| # | Provider | API $/1k | Tokens / query | LLM $/1k | **Total $/1k** | Correct | $ / correct answer |\n|---:|---|---:|---:|---:|---:|---:|---:|`;
  const body = rows.map((a, i) => `| ${i + 1} | \`${a.arm}\` | ${usd(a.api_usd_per_1k)} | ${num(a.tokens_per_query)} | ${usd(a.llm_usd_per_1k)} | **${usd(a.total_usd_per_1k)}** | ${a.correct_rate}% | ${usd(a.usd_per_correct, 4)} |`);
  const notes = [
    ...free.map((a) => `\`${a.arm}\` costs zero at the door on every plan of its vendor, free or paid. That is its list price, not a promotion, and the token column still applies.`),
    ...unpriced.map((a) => `\`${a.arm}\` is unranked: ${a.api_basis}. Unranked is not free.`),
  ];
  return `${head}\n${body.join('\n')}${notes.length ? `\n\n${notes.join('  \n')}` : ''}`;
};

/* --------------------------------------------------------------------- svg ---- */

const THEMES = {
  dark: { ground: '#0b0f11', alt: '#111819', line: '#1e2a30', ink: '#e8f0f2', dim: '#8aa0a7', faint: '#55686e', api: '#4a6b78', tok: '#d96f4c', hot: '#e8503a', good: '#35d6a4' },
  light: { ground: '#ffffff', alt: '#f7f9f9', line: '#e2e9eb', ink: '#0b1416', dim: '#5a6f76', faint: '#8095 9c'.replace(' ', ''), api: '#3d5f6c', tok: '#c85a36', hot: '#d63b22', good: '#0f9b72' },
};

const W = 880, ROW = 44, HEAD = 74, PAD = 22;
const TRACK_X = 262, TRACK_W = 344;
// Right-hand columns are laid out from the right edge inwards. Placing the quality
// percentage relative to the quality bar rather than to the page put it on top of the
// total: "$2.91" and "78%" printed as "$2.9?%".
const X_QBAR = W - PAD - 34, X_CORRECT = X_QBAR - 8, X_TOTAL = X_CORRECT - 48, X_TOK = X_TOTAL - 88;
const CAP = 60;                       // dollars; anything past this is drawn clipped
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// conservative monospace advance: real faces sit near 0.60em, 0.63 leaves room so a
// label never overflows the segment it was placed inside
const textW = (s, size) => s.length * size * 0.63;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const svg = (t) => {
  const H = HEAD + rows.length * ROW + 26 + 17 * (2 + free.length + unpriced.length);
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${MONO}">`);
  o.push(`<rect width="${W}" height="${H}" fill="${t.ground}"/>`);
  o.push(`<defs><clipPath id="sq"><rect width="26" height="26" rx="6"/></clipPath></defs>`);

  // legend
  const leg = [[t.api, 'request'], [t.tok, `tokens, read on ${R.answering_model.model.split('/')[1]} at $${R.answering_model.usd_per_mtok_input}/M`], [t.good, 'correct']];
  let lx = PAD;
  for (const [c, s] of leg) {
    o.push(`<rect x="${lx}" y="18" width="18" height="8" rx="1.5" fill="${c}"/>`);
    o.push(`<text x="${lx + 25}" y="26" font-size="10.5" fill="${t.faint}" letter-spacing="0.5">${esc(s)}</text>`);
    lx += 25 + textW(s, 10.5) + 24;
  }
  o.push(`<text x="${W - PAD}" y="26" font-size="10.5" fill="${t.faint}" text-anchor="end" letter-spacing="0.5">axis capped at $${CAP}</text>`);

  // header
  const th = (x, s, anchor = 'end') => `<text x="${x}" y="${HEAD - 14}" font-size="9.5" fill="${t.faint}" text-anchor="${anchor}" letter-spacing="1.25">${esc(s.toUpperCase())}</text>`;
  o.push(th(PAD, 'Provider', 'start'));
  o.push(th(TRACK_X, 'Cost of 1,000 queries', 'start'));
  o.push(th(X_TOK, 'Tok / query'));
  o.push(th(X_TOTAL, 'Total / 1k'));
  o.push(th(W - PAD, 'Correct'));
  o.push(`<line x1="${PAD}" y1="${HEAD - 7}" x2="${W - PAD}" y2="${HEAD - 7}" stroke="${t.line}"/>`);

  rows.forEach((a, i) => {
    const y = HEAD + i * ROW;
    const mid = y + ROW / 2;
    if (i % 2) o.push(`<rect x="0" y="${y}" width="${W}" height="${ROW}" fill="${t.alt}"/>`);
    o.push(`<line x1="${PAD}" y1="${y + ROW}" x2="${W - PAD}" y2="${y + ROW}" stroke="${t.line}" stroke-opacity="0.5"/>`);

    // brand mark on the vendor's own hue, then vendor and tier
    const src = mark(a.domain);
    o.push(`<g transform="translate(${PAD} ${mid - 13})">`);
    o.push(`<rect width="26" height="26" rx="6" fill="${src ? 'none' : a.hue}"/>`);
    if (src) o.push(`<image width="26" height="26" clip-path="url(#sq)" xlink:href="${src}" preserveAspectRatio="xMidYMid meet"/>`);
    else o.push(`<text x="13" y="18" font-size="13" font-weight="700" fill="#0b0f11" text-anchor="middle">${esc(a.vendor[0])}</text>`);
    o.push('</g>');
    o.push(`<text x="${PAD + 37}" y="${mid + 5}" font-size="13.5" fill="${t.ink}">${esc(a.vendor)} <tspan fill="${t.dim}">${esc(a.tier)}</tspan></text>`);

    // the bar: price at the door, then the tokens the payload pushes into the model
    const scale = TRACK_W / CAP;
    const apiW = Math.max(a.api_usd_per_1k * scale, a.api_usd_per_1k > 0 ? 2 : 0);
    const over = a.total_usd_per_1k > CAP;
    const tokW = Math.min(a.llm_usd_per_1k * scale, TRACK_W - apiW);
    const by = mid - 9, bh = 18;
    if (apiW > 0) o.push(`<rect x="${TRACK_X}" y="${by}" width="${apiW.toFixed(1)}" height="${bh}" rx="2.5" fill="${t.api}"/>`);
    o.push(`<rect x="${(TRACK_X + apiW).toFixed(1)}" y="${by}" width="${tokW.toFixed(1)}" height="${bh}" rx="2.5" fill="${over ? t.hot : t.tok}"/>`);
    if (over) {
      o.push(`<rect x="${TRACK_X + TRACK_W - 11}" y="${by - 3}" width="13" height="${bh + 6}" fill="${t.hot}"/>`);
      o.push(`<rect x="${TRACK_X + TRACK_W - 6}" y="${by - 3}" width="4" height="${bh + 6}" fill="${t.ground}"/>`);
    }

    const place = (text, x0, w) => {
      if (w < textW(text, 11) + 12) return null;
      return `<text x="${(x0 + w / 2).toFixed(1)}" y="${mid + 4}" font-size="11" font-weight="700" fill="${t.ground}" text-anchor="middle">${esc(text)}</text>`;
    };
    // The price at the door falls BACK, never forward. Queued after the token segment
    // it reads as part of it, which is the one misreading this chart exists to prevent.
    const aLab = a.api_usd_per_1k > 0 ? usd(a.api_usd_per_1k) : null;
    const inA = aLab && place(aLab, TRACK_X, apiW);
    if (inA) o.push(inA);
    else if (aLab) o.push(`<text x="${TRACK_X - 8}" y="${mid + 4}" font-size="11" font-weight="700" fill="${t.api}" text-anchor="end">${esc(aLab)}</text>`);
    const tLab = usd(a.llm_usd_per_1k);
    const inT = place(tLab, TRACK_X + apiW, tokW);
    if (inT) o.push(inT);
    else o.push(`<text x="${(TRACK_X + apiW + tokW + 8).toFixed(1)}" y="${mid + 4}" font-size="11" font-weight="700" fill="${over ? t.hot : t.tok}">${esc(tLab)}</text>`);

    o.push(`<text x="${X_TOK}" y="${mid + 5}" font-size="13" fill="${t.dim}" text-anchor="end">${num(a.tokens_per_query)}</text>`);
    o.push(`<text x="${X_TOTAL}" y="${mid + 5}" font-size="15" font-weight="700" fill="${t.ink}" text-anchor="end">${usd(a.total_usd_per_1k)}</text>`);
    o.push(`<text x="${X_CORRECT}" y="${mid + 5}" font-size="13" font-weight="700" fill="${t.ink}" text-anchor="end">${a.correct_rate}%</text>`);
    o.push(`<rect x="${X_QBAR}" y="${mid - 2}" width="34" height="4" rx="2" fill="${t.line}"/>`);
    o.push(`<rect x="${X_QBAR}" y="${mid - 2}" width="${(34 * a.correct_rate / 100).toFixed(1)}" height="4" rx="2" fill="${t.good}"/>`);
  });

  const fy = HEAD + rows.length * ROW + 24;
  const foot = [
    `${R.n} questions, ${R.date}. Answer key established on the day of the run by ${R.voters ? R.voters.length : '?'} independent systems, one vote per provider.`,
    `At n=${R.n} the correct column carries about plus or minus 10 points. The cost column does not.`,
    ...free.map((a) => `${a.arm} costs zero at the door on every plan of its vendor. That is its list price, not a promotion.`),
    ...unpriced.map((a) => `${a.arm} is unranked: ${a.api_basis}. Unranked is not free.`),
  ];
  // A note nobody can read is worse than no note: any line wider than the sheet is set
  // smaller rather than allowed to run off the edge.
  foot.forEach((s, i) => {
    const size = Math.min(10.5, ((W - 2 * PAD) / (s.length * 0.63)));
    o.push(`<text x="${PAD}" y="${fy + i * 17}" font-size="${size.toFixed(2)}" fill="${t.faint}">${esc(s)}</text>`);
  });
  o.push('</svg>');
  return o.join('\n');
};

/* ------------------------------------------------------------------ write ---- */

mkdirSync(`${ROOT}docs`, { recursive: true });
writeFileSync(`${ROOT}docs/table-dark.svg`, `${svg(THEMES.dark)}\n`);
writeFileSync(`${ROOT}docs/table-light.svg`, `${svg(THEMES.light)}\n`);

const table = md();
writeFileSync(`${ROOT}${RUNREL}/report.md`, `# ${RUNREL}\n\n${R.n} questions, ${R.date}, sorted by total cost.\n\n${table}\n`);

// The README carries the table itself, not a link to it. Injected between markers so a
// rebuild never touches the prose around it.
const readme = `${ROOT}README.md`;
if (existsSync(readme)) {
  const src = readFileSync(readme, 'utf8');
  const out = src.replace(/<!-- RESULTS -->[\s\S]*?<!-- \/RESULTS -->/, `<!-- RESULTS -->\n${table}\n<!-- /RESULTS -->`);
  if (out !== src) { writeFileSync(readme, out); console.log('README results table updated'); }
  else console.log('README has no <!-- RESULTS --> markers; table not injected');
}

console.log(`docs/table-dark.svg, docs/table-light.svg, ${RUNREL}/report.md`);
console.log(`${rows.length} arms ranked by ${SORT}${unpriced.length ? `, ${unpriced.length} unpriced and unranked` : ''}`);
