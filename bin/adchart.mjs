// The ad creatives. Not the benchmark: a subset, drawn to be read at a glance.
//
//   --scatter   cost against score, in the style of the charts vendors publish:
//               a small outlined dot, its name immediately beside it, nothing else.
//               Few enough points that no label ever needs to move.
//   default     cost as a bar per provider, which is the one comparison where the
//               ranking is unambiguous and the gaps are large.
//
// Usage: node bin/adchart.mjs [--run=runs/<date>] [--scatter] [--only=a,b,c]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const SCATTER = process.argv.includes('--scatter');
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
// Ours, but at the expensive end: drawn like everyone else rather than picked out, so
// the accent colour only ever lands on rows that carry the argument.
const DIM = arg('dim', 'serpdive-moby').split(',').filter(Boolean);
const R = JSON.parse(readFileSync(`${ROOT}${RUNREL}/results.json`, 'utf8'));

const DOMAIN = { SERPdive: 'serpdive.com', Parallel: 'parallel.ai', Tavily: 'tavily.com', 'You.com': 'you.com', Firecrawl: 'firecrawl.dev', Linkup: 'linkup.so', Brave: 'brave.com', Exa: 'exa.ai' };
const markOf = (d) => { const f = `${ROOT}docs/marks/${d}.png`; return existsSync(f) ? `data:image/png;base64,${readFileSync(f).toString('base64')}` : null; };
const VENDOR = { serpdive: 'SERPdive', parallel: 'Parallel', tavily: 'Tavily', you: 'You.com', firecrawl: 'Firecrawl', linkup: 'Linkup', brave: 'Brave', exa: 'Exa' };
const TIER = { krill: 'Krill', mako: 'Mako', moby: 'Moby', turbo: 'Turbo', basic: 'Basic', advanced: 'Advanced', standard: 'Standard', search: '', web: '' };

const all = R.arms.filter((a) => a.total_usd_per_1k != null).map((a) => {
  const vendor = VENDOR[a.vendor] || a.vendor;
  const t = TIER[a.arm.replace(/^[a-z]+-/, '')] ?? '';
  return { ...a, label: t ? `${vendor} ${t}` : vendor, domain: DOMAIN[vendor] || '', mine: a.vendor === 'serpdive' && !DIM.includes(a.arm) };
});
const pts = (ONLY ? ONLY.map((n) => all.find((a) => a.arm === n)).filter(Boolean) : all)
  .sort((a, b) => a.total_usd_per_1k - b.total_usd_per_1k);

const T = {
  dark: { ground: '#0b0f11', grid: '#1a2429', axis: '#33424a', ink: '#f2f7f8', dim: '#a9bcc2', faint: '#66797f', mine: '#35d6a4', other: '#8fa3aa', edge: '#0b0f11' },
  light: { ground: '#ffffff', grid: '#edf1f2', axis: '#ccd6d9', ink: '#0c1517', dim: '#4d6168', faint: '#8fa0a5', mine: '#0aa87d', other: '#b9c6cb', edge: '#ffffff' },
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tw = (s, z) => s.length * z * 0.55;
const FONT = "ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif";

/* ------------------------------------------------------------------ scatter ---- */

const scatter = (t) => {
  const W = 860, H = 470, L = 62, Rr = 30, TT = 76, B = 62;
  const PW = W - L - Rr, PH = H - TT - B;
  const cHi = Math.ceil(Math.max(...pts.map((p) => p.total_usd_per_1k)) / 10) * 10 + 5;
  const qs = pts.map((p) => p.correct_rate);
  const qLo = Math.floor((Math.min(...qs) - 3) / 5) * 5, qHi = Math.ceil((Math.max(...qs) + 3) / 5) * 5;
  const px = (c) => L + (c / cHi) * PW;
  const py = (q) => TT + (1 - (q - qLo) / (qHi - qLo)) * PH;
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`,
    `<rect width="${W}" height="${H}" fill="${t.ground}"/>`,
    `<text x="${L}" y="36" font-size="20" font-weight="700" fill="${t.ink}">What 1,000 agent searches really cost</text>`,
    `<text x="${L}" y="57" font-size="12.5" fill="${t.dim}">The request, plus the tokens its payload pushes into your model.</text>`];
  for (let q = qLo; q <= qHi; q += 5) {
    const y = py(q);
    o.push(`<line x1="${L}" y1="${y.toFixed(1)}" x2="${L + PW}" y2="${y.toFixed(1)}" stroke="${t.grid}"/>`);
    o.push(`<text x="${L - 10}" y="${(y + 4).toFixed(1)}" font-size="11.5" fill="${t.faint}" text-anchor="end">${q}</text>`);
  }
  for (let c = 0; c <= cHi; c += 10) o.push(`<text x="${px(c).toFixed(1)}" y="${TT + PH + 20}" font-size="11.5" fill="${t.faint}" text-anchor="middle">$${c}</text>`);
  o.push(`<line x1="${L}" y1="${TT + PH}" x2="${L + PW}" y2="${TT + PH}" stroke="${t.axis}"/>`);
  o.push(`<line x1="${L}" y1="${TT}" x2="${L}" y2="${TT + PH}" stroke="${t.axis}"/>`);
  o.push(`<text x="${L + PW / 2}" y="${TT + PH + 44}" font-size="12" fill="${t.dim}" text-anchor="middle">cost per 1,000 queries</text>`);
  o.push(`<text x="16" y="${TT + PH / 2}" font-size="12" fill="${t.dim}" text-anchor="middle" transform="rotate(-90 16 ${TT + PH / 2})">answers correct (%)</text>`);
  // The name sits at the same height as its dot, always, on whichever side has room.
  // Nothing is nudged: the set is small enough that nothing needs to be.
  for (const p of pts) {
    const x = px(p.total_usd_per_1k), y = py(p.correct_rate);
    const right = x + 14 + tw(p.label, 14) < L + PW - 4;
    o.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${p.mine ? t.mine : t.other}" stroke="${t.edge}" stroke-width="1.5"/>`);
    o.push(`<text x="${(right ? x + 12 : x - 12).toFixed(1)}" y="${(y + 5).toFixed(1)}" font-size="14" font-weight="700" fill="${p.mine ? t.mine : t.ink}" text-anchor="${right ? 'start' : 'end'}">${esc(p.label)}</text>`);
  }
  o.push(`<text x="${L}" y="${H - 12}" font-size="10.5" fill="${t.faint}">${esc(`${R.n} questions, ${R.date}. github.com/edendalexis/search-api-cost-benchmark`)}</text>`);
  return `${o.join('\n')}\n</svg>`;
};

/* --------------------------------------------------------------------- bars ---- */

const bars = (t) => {
  const ROW = 34, L = 148, Rr = 92, TT = 84, B = 44;
  const W = 860, H = TT + pts.length * ROW + B;
  const PW = W - L - Rr;
  const hi = Math.max(...pts.map((p) => p.total_usd_per_1k));
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`,
    `<rect width="${W}" height="${H}" fill="${t.ground}"/>`,
    `<text x="24" y="38" font-size="21" font-weight="700" fill="${t.ink}">What 1,000 agent searches really cost</text>`,
    `<text x="24" y="60" font-size="12.5" fill="${t.dim}">The price per request, plus the tokens its payload pushes into your model.</text>`];
  pts.forEach((p, i) => {
    const y = TT + i * ROW, mid = y + ROW / 2;
    const w = (p.total_usd_per_1k / hi) * PW;
    o.push(`<text x="${L - 12}" y="${(mid + 5).toFixed(1)}" font-size="13.5" font-weight="${p.mine ? 700 : 500}" fill="${p.mine ? t.mine : t.dim}" text-anchor="end">${esc(p.label)}</text>`);
    o.push(`<rect x="${L}" y="${mid - 9}" width="${w.toFixed(1)}" height="18" rx="3" fill="${p.mine ? t.mine : t.other}"/>`);
    o.push(`<text x="${(L + w + 10).toFixed(1)}" y="${(mid + 5).toFixed(1)}" font-size="14" font-weight="700" fill="${p.mine ? t.mine : t.ink}">$${p.total_usd_per_1k.toFixed(2)}</text>`);
  });
  o.push(`<text x="24" y="${H - 14}" font-size="10.5" fill="${t.faint}">${esc(`${R.n} questions, ${R.date}. github.com/edendalexis/search-api-cost-benchmark`)}</text>`);
  return `${o.join('\n')}\n</svg>`;
};

/* -------------------------------------------------------------------- table ---- */

const table = (t) => {
  const ROW = 40, W = 900, L = 24, TT = 92, B = 40;
  const H = TT + pts.length * ROW + B;
  const NAME = 210, BAR_X = L + NAME, BAR_W = 430, X_TOTAL = BAR_X + BAR_W + 92, X_OK = W - L;
  const hi = Math.max(...pts.map((p) => p.total_usd_per_1k));
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`,
    `<rect width="${W}" height="${H}" fill="${t.ground}"/>`,
    `<defs><clipPath id="lg"><rect width="24" height="24" rx="6"/></clipPath></defs>`,
    `<text x="${L}" y="40" font-size="22" font-weight="700" fill="${t.ink}">What 1,000 agent searches really cost</text>`,
    `<text x="${L}" y="62" font-size="13" fill="${t.dim}">The price per request, plus the tokens its payload pushes into your model.</text>`,
    `<text x="${X_TOTAL}" y="${TT - 14}" font-size="10" letter-spacing="1.2" fill="${t.faint}" text-anchor="end">COST / 1K</text>`,
    `<text x="${X_OK}" y="${TT - 14}" font-size="10" letter-spacing="1.2" fill="${t.faint}" text-anchor="end">CORRECT</text>`,
    `<line x1="${L}" y1="${TT - 7}" x2="${W - L}" y2="${TT - 7}" stroke="${t.grid}"/>`];
  pts.forEach((p, i) => {
    const y = TT + i * ROW, mid = y + ROW / 2;
    o.push(`<line x1="${L}" y1="${y + ROW}" x2="${W - L}" y2="${y + ROW}" stroke="${t.grid}"/>`);
    const src = markOf(p.domain);
    if (src) o.push(`<g transform="translate(${L} ${mid - 12})"><image width="24" height="24" clip-path="url(#lg)" href="${src}" xlink:href="${src}"/></g>`);
    o.push(`<text x="${L + 34}" y="${(mid + 5).toFixed(1)}" font-size="14.5" font-weight="${p.mine ? 700 : 500}" fill="${p.mine ? t.mine : t.ink}">${esc(p.label)}</text>`);
    const w = Math.max((p.total_usd_per_1k / hi) * BAR_W, 3);
    o.push(`<rect x="${BAR_X}" y="${mid - 9}" width="${w.toFixed(1)}" height="18" rx="3" fill="${p.mine ? t.mine : t.other}"/>`);
    o.push(`<text x="${X_TOTAL}" y="${(mid + 6).toFixed(1)}" font-size="15.5" font-weight="700" fill="${p.mine ? t.mine : t.ink}" text-anchor="end">$${p.total_usd_per_1k.toFixed(2)}</text>`);
    o.push(`<text x="${X_OK}" y="${(mid + 5).toFixed(1)}" font-size="13.5" fill="${t.dim}" text-anchor="end">${p.correct_rate}%</text>`);
  });
  o.push(`<text x="${L}" y="${H - 14}" font-size="10.5" fill="${t.faint}">${esc(`${R.n} questions, ${R.date}. github.com/edendalexis/search-api-cost-benchmark`)}</text>`);
  return `${o.join('\n')}\n</svg>`;
};

const TABLE = process.argv.includes('--table');
const draw = TABLE ? table : SCATTER ? scatter : bars;
const stem = TABLE ? 'ad-table' : SCATTER ? 'ad-scatter' : 'ad-bars';
mkdirSync(`${ROOT}docs`, { recursive: true });
writeFileSync(`${ROOT}docs/${stem}-dark.svg`, `${draw(T.dark)}\n`);
writeFileSync(`${ROOT}docs/${stem}-light.svg`, `${draw(T.light)}\n`);
console.log(`docs/${stem}-{dark,light}.svg — ${pts.length} arms`);
