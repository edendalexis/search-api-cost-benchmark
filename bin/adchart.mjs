// The ad creative. Not the benchmark: a subset, chosen so the picture reads.
//
// A dot marks the data. The logo and the name sit diagonally above it, clear of the
// point and clear of each other. Everything above $60 is left out so the interesting
// half of the price axis can be stretched across the full width.
//
// Usage: node bin/adchart.mjs [--run=runs/<date>] [--max=60]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const MAX = parseFloat(arg('max', 60));
const R = JSON.parse(readFileSync(`${ROOT}${RUNREL}/results.json`, 'utf8'));

const VENDOR = { serpdive: 'SERPdive', parallel: 'Parallel', tavily: 'Tavily', you: 'You.com', firecrawl: 'Firecrawl', linkup: 'Linkup', brave: 'Brave', exa: 'Exa' };
const DOMAIN = { SERPdive: 'serpdive.com', Parallel: 'parallel.ai', Tavily: 'tavily.com', 'You.com': 'you.com', Firecrawl: 'firecrawl.dev', Linkup: 'linkup.so', Brave: 'brave.com', Exa: 'exa.ai' };
const TIER = { krill: 'Krill', mako: 'Mako', moby: 'Moby', turbo: 'Turbo', basic: 'Basic', advanced: 'Advanced', standard: 'Standard', search: '', web: '' };
const mark = (d) => { const f = `${ROOT}docs/marks/${d}.png`; return existsSync(f) ? `data:image/png;base64,${readFileSync(f).toString('base64')}` : null; };

const pts = R.arms
  .filter((a) => a.total_usd_per_1k != null && a.total_usd_per_1k <= MAX)
  .map((a) => {
    const vendor = VENDOR[a.vendor] || a.vendor;
    const t = TIER[a.arm.replace(/^[a-z]+-/, '')] ?? '';
    return { ...a, label: t ? `${vendor} ${t}` : vendor, domain: DOMAIN[vendor] || '', mine: a.vendor === 'serpdive' };
  });

const THEMES = {
  dark: { ground: '#0b0f11', grid: '#192327', axis: '#2b383e', ink: '#eef4f5', dim: '#9fb2b8', faint: '#63767d', mine: '#35d6a4', other: '#7f939a' },
  light: { ground: '#ffffff', grid: '#eef2f3', axis: '#d2dadd', ink: '#0d1618', dim: '#5f747b', faint: '#93a3a8', mine: '#0d9c76', other: '#8496 9c'.replace(' ', '') },
};

const W = 880, H = 500;
const L = 62, Rr = 26, T = 74, B = 66;
const PW = W - L - Rr, PH = H - T - B;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tw = (s, size) => s.length * size * 0.55;

const cHi = Math.ceil(Math.max(...pts.map((p) => p.total_usd_per_1k)) / 10) * 10 + 4;
const qs = pts.map((p) => p.correct_rate);
const qLo = Math.floor(Math.min(...qs) / 2) * 2 - 2, qHi = Math.ceil(Math.max(...qs) / 2) * 2 + 2;
const px = (c) => L + (c / cHi) * PW;
const py = (q) => T + (1 - (q - qLo) / (qHi - qLo)) * PH;

const svg = (t) => {
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif">`);
  o.push(`<rect width="${W}" height="${H}" fill="${t.ground}"/>`);
  o.push(`<defs><clipPath id="lg"><rect width="19" height="19" rx="4.5"/></clipPath></defs>`);
  o.push(`<text x="${L}" y="36" font-size="20" font-weight="700" fill="${t.ink}">What 1,000 agent searches really cost</text>`);
  o.push(`<text x="${L}" y="56" font-size="12.5" fill="${t.dim}">The request, plus the tokens its payload pushes into your model.</text>`);

  for (let q = Math.ceil(qLo / 5) * 5; q <= qHi; q += 5) {
    const y = py(q);
    o.push(`<line x1="${L}" y1="${y.toFixed(1)}" x2="${L + PW}" y2="${y.toFixed(1)}" stroke="${t.grid}"/>`);
    o.push(`<text x="${L - 10}" y="${(y + 4).toFixed(1)}" font-size="11.5" fill="${t.faint}" text-anchor="end">${q}%</text>`);
  }
  for (let c = 0; c <= cHi; c += 10) {
    o.push(`<text x="${px(c).toFixed(1)}" y="${T + PH + 20}" font-size="11.5" fill="${t.faint}" text-anchor="middle">$${c}</text>`);
  }
  o.push(`<line x1="${L}" y1="${T + PH}" x2="${L + PW}" y2="${T + PH}" stroke="${t.axis}"/>`);
  o.push(`<line x1="${L}" y1="${T}" x2="${L}" y2="${T + PH}" stroke="${t.axis}"/>`);
  o.push(`<text x="${L + PW / 2}" y="${T + PH + 44}" font-size="12" fill="${t.dim}" text-anchor="middle">cost per 1,000 queries</text>`);
  o.push(`<text x="16" y="${T + PH / 2}" font-size="12" fill="${t.dim}" text-anchor="middle" transform="rotate(-90 16 ${T + PH / 2})">answers correct</text>`);

  // dot at the data, logo and name on a diagonal above it
  const taken = pts.map((p) => { const x = px(p.total_usd_per_1k), y = py(p.correct_rate); return { x0: x - 9, x1: x + 9, y0: y - 9, y1: y + 9 }; });
  for (const p of [...pts].sort((a, b) => a.total_usd_per_1k - b.total_usd_per_1k)) {
    const x = px(p.total_usd_per_1k), y = py(p.correct_rate);
    const col = p.mine ? t.mine : t.other;
    const wide = 19 + 7 + tw(p.label, 13.5);
    // Flipping to the left of a point throws a wide label a couple of hundred pixels
    // away from the dot it belongs to, so the left side is only tried when the point
    // is close enough to the right edge that there is no other choice.
    const nearRight = x + 13 + wide > L + PW - 3;
    const DIAG = nearRight ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[1, -1], [1, 1], [-1, -1], [-1, 1]];
    // Side first, distance second. Trying every diagonal at the shortest distance
    // before trying the preferred diagonal a little further out sent labels to the
    // wrong side of their dot for the sake of thirteen pixels.
    let best = null;
    for (const [sx, sy] of DIAG) {
      for (const d of [13, 19, 26, 34, 44]) {
        const gx = sx > 0 ? x + d : x - d - wide;
        const gy = y + sy * d - 10;
        const b = { x0: gx, x1: gx + wide, y0: gy, y1: gy + 20 };
        if (b.x0 < L + 3 || b.x1 > L + PW - 3 || b.y0 < T + 2 || b.y1 > T + PH - 2) continue;
        if (taken.some((q) => b.x0 < q.x1 + 4 && b.x1 + 4 > q.x0 && b.y0 < q.y1 + 2 && b.y1 + 2 > q.y0)) continue;
        best = b; break;
      }
      if (best) break;
    }
    if (!best) { const gx = Math.min(x + 13, L + PW - 3 - wide); best = { x0: gx, x1: gx + wide, y0: y - 23, y1: y - 3 }; }
    taken.push(best);

    o.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="${col}"/>`);
    const src = mark(p.domain);
    o.push(`<g transform="translate(${best.x0.toFixed(1)} ${best.y0.toFixed(1)})">`);
    if (src) o.push(`<image width="19" height="19" clip-path="url(#lg)" href="${src}" xlink:href="${src}" preserveAspectRatio="xMidYMid meet"/>`);
    o.push('</g>');
    o.push(`<text x="${(best.x0 + 26).toFixed(1)}" y="${(best.y0 + 14).toFixed(1)}" font-size="13.5" font-weight="${p.mine ? 700 : 500}" fill="${p.mine ? t.ink : t.dim}">${esc(p.label)}</text>`);
  }

  o.push(`<text x="${L}" y="${H - 14}" font-size="11" fill="${t.faint}">${esc(`${R.n} questions, ${R.date}. Every payload, grade and price: github.com/edendalexis/search-api-cost-benchmark`)}</text>`);
  o.push('</svg>');
  return o.join('\n');
};

mkdirSync(`${ROOT}docs`, { recursive: true });
writeFileSync(`${ROOT}docs/ad-dark.svg`, `${svg(THEMES.dark)}\n`);
writeFileSync(`${ROOT}docs/ad-light.svg`, `${svg(THEMES.light)}\n`);
console.log(`docs/ad-dark.svg, docs/ad-light.svg — ${pts.length} arms under $${MAX}`);
