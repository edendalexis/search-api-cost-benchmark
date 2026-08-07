// The cost/quality trade-off, plotted plainly.
//
// A logo, its name beside it, and nothing else. Rings, leader lines and corner arrows
// were all attempts to fix label collisions and they made the picture unreadable; the
// collisions are fixed by making the marks small and the labels short instead.
//
// Conventional axes: money along the bottom starting at zero, score up the side. The
// cheap configurations bunch against the left edge and the expensive ones sprawl right,
// which is not a defect of the scale, it is the shape of the market.
//
// Usage: node bin/scatter.mjs [--run=runs/<date>]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const RUNREL = arg('run', `runs/${new Date().toISOString().slice(0, 10)}`);
const R = JSON.parse(readFileSync(`${ROOT}${RUNREL}/results.json`, 'utf8'));

const VENDOR = {
  serpdive: 'SERPdive', parallel: 'Parallel', tavily: 'Tavily', you: 'You.com',
  firecrawl: 'Firecrawl', linkup: 'Linkup', brave: 'Brave', exa: 'Exa',
};
const DOMAIN = {
  SERPdive: 'serpdive.com', Parallel: 'parallel.ai', Tavily: 'tavily.com', 'You.com': 'you.com',
  Firecrawl: 'firecrawl.dev', Linkup: 'linkup.so', Brave: 'brave.com', Exa: 'exa.ai',
};
const mark = (d) => {
  const f = `${ROOT}docs/marks/${d}.png`;
  return existsSync(f) ? `data:image/png;base64,${readFileSync(f).toString('base64')}` : null;
};

const TIER = { krill: 'Krill', mako: 'Mako', moby: 'Moby', turbo: 'Turbo', basic: 'Basic', advanced: 'Advanced', standard: 'Standard', highlights: 'Highlights', search: '', web: '' };
const pts = R.arms.filter((a) => a.total_usd_per_1k != null).map((a) => {
  const vendor = VENDOR[a.vendor] || a.vendor;
  const t = TIER[a.arm.replace(/^[a-z]+-/, '')] ?? '';
  return { ...a, label: t ? `${vendor} ${t}` : vendor, domain: DOMAIN[vendor] || '', mine: a.vendor === 'serpdive' };
});

const THEMES = {
  light: { ground: '#ffffff', grid: '#eceff0', axis: '#d3dadc', ink: '#111a1c', dim: '#6b7f86', faint: '#93a3a8', mine: '#0d9c76', other: '#93a3a8' },
  dark: { ground: '#0b0f11', grid: '#171f23', axis: '#26333a', ink: '#eef4f5', dim: '#93a8af', faint: '#5e727a', mine: '#35d6a4', other: '#5e727a' },
};

const W = 1000, H = 760;
const L = 84, Rr = 26, T = 92, B = 96;
const PW = W - L - Rr, PH = H - T - B;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tw = (s, size) => s.length * size * 0.56;

const COSTS = [0, 25, 50, 75, 100, 125, 150, 175, 200];
const SCORES = [70, 75, 80, 85, 90, 95, 100];
const cLo = 0, cHi = 215, qLo = 70, qHi = 100;
const px = (c) => L + ((c - cLo) / (cHi - cLo)) * PW;
const py = (q) => T + (1 - (q - qLo) / (qHi - qLo)) * PH;

const svg = (t) => {
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif">`);
  o.push(`<rect width="${W}" height="${H}" fill="${t.ground}"/>`);
  o.push(`<defs><clipPath id="sq"><rect width="22" height="22" rx="5"/></clipPath></defs>`);

  o.push(`<text x="${L}" y="40" font-size="22" font-weight="700" fill="${t.ink}">Cost of 1,000 agent searches</text>`);
  o.push(`<text x="${L}" y="62" font-size="13" fill="${t.dim}">${esc(`${R.n} questions, ${R.date}. The request, plus the tokens its payload pushes into the answering model.`)}</text>`);

  for (const q of SCORES) {
    const y = py(q);
    o.push(`<line x1="${L}" y1="${y.toFixed(1)}" x2="${L + PW}" y2="${y.toFixed(1)}" stroke="${t.grid}"/>`);
    o.push(`<text x="${L - 12}" y="${(y + 4).toFixed(1)}" font-size="12" fill="${t.faint}" text-anchor="end">${q}%</text>`);
  }
  for (const c of COSTS) {
    o.push(`<text x="${px(c).toFixed(1)}" y="${T + PH + 24}" font-size="12" fill="${t.faint}" text-anchor="middle">$${c}</text>`);
  }
  o.push(`<line x1="${L}" y1="${T + PH}" x2="${L + PW}" y2="${T + PH}" stroke="${t.axis}"/>`);
  o.push(`<line x1="${L}" y1="${T}" x2="${L}" y2="${T + PH}" stroke="${t.axis}"/>`);
  o.push(`<text x="${L + PW / 2}" y="${T + PH + 52}" font-size="12.5" fill="${t.dim}" text-anchor="middle">cost per 1,000 queries</text>`);
  o.push(`<text x="20" y="${T + PH / 2}" font-size="12.5" fill="${t.dim}" text-anchor="middle" transform="rotate(-90 20 ${T + PH / 2})">answers graded correct, out of 100</text>`);

  // A small mark and its name. Nothing else: the only freedom left is which side the
  // name sits on and a few pixels of vertical give when two points are on top of
  // each other.
  // Every mark is an obstacle from the start. Adding them as we went meant a label
  // could be placed on a logo that had not been drawn yet, which is how Mako's name
  // ended up underneath Tavily's icon.
  const taken = pts.map((p) => {
    const x = px(p.total_usd_per_1k), y = py(p.correct_rate);
    return { x0: x - 13, x1: x + 13, y0: y - 13, y1: y + 13 };
  });
  for (const p of [...pts].sort((a, b) => a.total_usd_per_1k - b.total_usd_per_1k)) {
    const x = px(p.total_usd_per_1k), y = py(p.correct_rate);
    const wide = tw(p.label, 14);
    const inward = x > L + PW * 0.68 ? [-1, 1] : [1, -1];
    let best = null;
    for (const dy of [0, -16, 16, -30, 30, -44, 44]) {
      for (const side of inward) {
        const x0 = side > 0 ? x + 17 : x - 17 - wide;
        const b = { x0, x1: x0 + wide, y0: y + dy - 9, y1: y + dy + 6 };
        if (b.x0 < L + 3 || b.x1 > L + PW - 3) continue;
        const clash = taken.some((q) => b.x0 < q.x1 + 6 && b.x1 + 6 > q.x0 && b.y0 < q.y1 + 2 && b.y1 + 2 > q.y0);
        if (!clash) { best = { b, dy }; break; }
      }
      if (best) break;
    }
    if (!best) { const x0 = x + 17; best = { b: { x0, x1: x0 + wide, y0: y - 9, y1: y + 6 }, dy: 0 }; }
    taken.push(best.b);

    const src = mark(p.domain);
    o.push(`<g transform="translate(${(x - 11).toFixed(1)} ${(y - 11).toFixed(1)})">`);
    if (src) o.push(`<image width="22" height="22" clip-path="url(#sq)" href="${src}" xlink:href="${src}" preserveAspectRatio="xMidYMid meet"/>`);
    else o.push(`<circle cx="11" cy="11" r="9" fill="${p.mine ? t.mine : t.other}"/>`);
    o.push('</g>');
    o.push(`<text x="${best.b.x0.toFixed(1)}" y="${(y + best.dy + 5).toFixed(1)}" font-size="14" font-weight="${p.mine ? 700 : 500}" fill="${p.mine ? t.mine : t.dim}">${esc(p.label)}</text>`);
  }

  o.push(`<text x="${L}" y="${H - 26}" font-size="11.5" fill="${t.faint}">${esc(`Answer key established on the day of the run by 8 independent systems, one vote per provider.`)}</text>`);
  o.push(`<text x="${L}" y="${H - 10}" font-size="11.5" fill="${t.faint}">${esc(`At n=${R.n} the horizontal axis carries about plus or minus 10 points. The vertical axis does not.`)}</text>`);
  o.push('</svg>');
  return o.join('\n');
};

mkdirSync(`${ROOT}docs`, { recursive: true });
writeFileSync(`${ROOT}docs/scatter-light.svg`, `${svg(THEMES.light)}\n`);
writeFileSync(`${ROOT}docs/scatter-dark.svg`, `${svg(THEMES.dark)}\n`);
console.log('docs/scatter-light.svg, docs/scatter-dark.svg');
