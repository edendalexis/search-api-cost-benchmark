// The cost/quality trade-off as a position rather than a ranking.
//
// A table makes you read thirteen rows and hold them in your head. A scatter makes the
// trade-off geometric: everything up and to the right is better, and where a provider
// sits is a fact about the numbers, not a claim by whoever drew it.
//
// Two axis decisions, both stated on the chart itself because both change what you see.
// Cost runs from $2.91 to $203.63, a seventyfold spread, so a linear axis would crush
// eleven of the thirteen points against one edge: the scale is logarithmic and the
// gridlines carry real dollar figures. And the cost axis is INVERTED, cheaper towards
// the top, so that the desirable corner is the top right the way a reader expects.
//
// Usage: node bin/scatter.mjs [--run=runs/<date>] [--theme=dark|light]
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

const pts = R.arms.filter((a) => a.total_usd_per_1k != null).map((a) => {
  const vendor = VENDOR[a.vendor] || a.vendor;
  return { ...a, vendor, tier: a.arm.replace(/^[a-z]+-/, ''), domain: DOMAIN[vendor] || '', mine: a.vendor === 'serpdive' };
});

const THEMES = {
  dark: { ground: '#0b0f11', grid: '#18242a', axis: '#2a3b43', ink: '#e8f0f2', dim: '#8aa0a7', faint: '#55686e', mine: '#35d6a4', other: '#7d939b' },
  light: { ground: '#ffffff', grid: '#eef3f4', axis: '#cfdadd', ink: '#0b1416', dim: '#5a6f76', faint: '#8a9ba1', mine: '#0f9b72', other: '#5a6f76' },
};

const W = 1000, H = 1000;
const L = 96, Rr = 30, T = 112, B = 126;                 // plot margins
const PW = W - L - Rr, PH = H - T - B;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tw = (s, size) => s.length * size * 0.6;

const COSTS = [3, 5, 10, 20, 50, 100, 200];
const cLo = 2.6, cHi = 230;                              // a little air beyond the data
const qLo = 75, qHi = 97;
const px = (q) => L + ((q - qLo) / (qHi - qLo)) * PW;
const py = (c) => T + ((Math.log(c) - Math.log(cLo)) / (Math.log(cHi) - Math.log(cLo))) * PH;

const svg = (t) => {
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">`);
  o.push(`<rect width="${W}" height="${H}" fill="${t.ground}"/>`);
  o.push(`<defs><clipPath id="sq"><rect width="34" height="34" rx="8"/></clipPath></defs>`);

  // title
  o.push(`<text x="${L}" y="44" font-size="25" font-weight="700" fill="${t.ink}">What a thousand agent searches cost</text>`);
  o.push(`<text x="${L}" y="68" font-size="13" fill="${t.dim}">${esc(`${R.n} questions, 13 priced configurations, ${R.date}.`)}</text>`);
  o.push(`<text x="${L}" y="86" font-size="13" fill="${t.dim}">${esc('Cost is the request plus the tokens its payload pushes into the answering model.')}</text>`);

  // grid
  for (const c of COSTS) {
    const y = py(c);
    o.push(`<line x1="${L}" y1="${y.toFixed(1)}" x2="${L + PW}" y2="${y.toFixed(1)}" stroke="${t.grid}"/>`);
    o.push(`<text x="${L - 12}" y="${(y + 4).toFixed(1)}" font-size="13" fill="${t.faint}" text-anchor="end">$${c}</text>`);
  }
  for (const q of [80, 85, 90, 95]) {
    const x = px(q);
    o.push(`<line x1="${x.toFixed(1)}" y1="${T}" x2="${x.toFixed(1)}" y2="${T + PH}" stroke="${t.grid}"/>`);
    o.push(`<text x="${x.toFixed(1)}" y="${T + PH + 26}" font-size="13" fill="${t.faint}" text-anchor="middle">${q}%</text>`);
  }
  o.push(`<line x1="${L}" y1="${T + PH}" x2="${L + PW}" y2="${T + PH}" stroke="${t.axis}"/>`);
  o.push(`<line x1="${L}" y1="${T}" x2="${L}" y2="${T + PH}" stroke="${t.axis}"/>`);

  // axis names
  o.push(`<text x="${L + PW / 2}" y="${T + PH + 58}" font-size="13.5" fill="${t.dim}" text-anchor="middle">answers graded correct, out of ${R.n}</text>`);
  o.push(`<text x="26" y="${T + PH / 2}" font-size="13.5" fill="${t.dim}" text-anchor="middle" transform="rotate(-90 26 ${T + PH / 2})">cost per 1,000 queries, log scale, cheaper is higher</text>`);

  // the good corner, said once
  o.push(`<text x="${L + PW}" y="${T - 14}" font-size="13" fill="${t.faint}" text-anchor="end">cheaper and more correct</text>`);
  o.push(`<path d="M ${L + PW - 150} ${T - 32} L ${L + PW} ${T - 32}" stroke="${t.faint}" stroke-width="1" fill="none"/>`);
  o.push(`<path d="M ${L + PW - 8} ${T - 36} L ${L + PW} ${T - 32} L ${L + PW - 8} ${T - 28} Z" fill="${t.faint}"/>`);

  // points, cheapest first so the expensive ones cannot bury them
  const placed = pts.map((p) => {
    const x = px(p.correct_rate), y = py(p.total_usd_per_1k), r = p.mine ? 30 : 18;
    return { x0: x - r, x1: x + r, y0: y - r, y1: y + r };
  });

  for (const p of [...pts].sort((a, b) => a.total_usd_per_1k - b.total_usd_per_1k)) {
    const x = px(p.correct_rate), y = py(p.total_usd_per_1k);
    const col = p.mine ? t.mine : t.other;
    if (p.mine) o.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="28" fill="none" stroke="${t.mine}" stroke-width="2" opacity="0.6"/>`);
    const src = mark(p.domain);
    o.push(`<g transform="translate(${(x - 17).toFixed(1)} ${(y - 17).toFixed(1)})">`);
    if (src) o.push(`<image width="34" height="34" clip-path="url(#sq)" href="${src}" xlink:href="${src}" preserveAspectRatio="xMidYMid meet"/>`);
    else o.push(`<circle cx="17" cy="17" r="14" fill="${col}"/>`);
    o.push('</g>');

    // ONE LINE, not two. A two-line label is a tall box, and a tall box collides with
    // everything, which pushed labels so far from their points that you could no longer
    // tell which logo they belonged to.
    const name = `${p.vendor} ${p.tier}`;
    const price = `$${p.total_usd_per_1k.toFixed(2)}`;
    const wName = tw(name, 15), wPrice = tw(price, 15), wide = wName + 10 + wPrice;
    const gap = p.mine ? 34 : 24;
    // Score every position that fits inside the plot and take the least bad, rather
    // than the first that happens to work. First-fit had a fallback that ignored the
    // frame, which is how three labels ended up running off the right edge.
    const inward = x > L + PW / 2 ? [-1, 1] : [1, -1];
    const cands = [];
    for (const dy of [0, -26, 26, -50, 50, -74, 74]) {
      for (const side of inward) {
        const ly = y + dy;
        const x0 = side > 0 ? x + gap : x - gap - wide;
        const b = { x0, x1: x0 + wide, y0: ly - 11, y1: ly + 7 };
        if (b.x0 < L + 4 || b.x1 > L + PW - 4 || b.y0 < T + 4 || b.y1 > T + PH - 4) continue;
        const clashes = placed.filter((q) => b.x0 < q.x1 + 7 && b.x1 + 7 > q.x0 && b.y0 < q.y1 + 3 && b.y1 + 3 > q.y0).length;
        cands.push({ side, dy, ly, b, cost: clashes * 1000 + Math.abs(dy) + (side === inward[0] ? 0 : 6) });
      }
    }
    cands.sort((a, b) => a.cost - b.cost);
    const best = cands[0] || (() => {
      const x0 = Math.min(Math.max(x + gap, L + 4), L + PW - 4 - wide);
      return { side: 1, dy: 0, ly: y, b: { x0, x1: x0 + wide, y0: y - 11, y1: y + 7 } };
    })();
    placed.push(best.b);

    // a leader only when the label had to move off its point's line
    if (Math.abs(best.dy) > 4) {
      const ax = best.side > 0 ? best.b.x0 - 6 : best.b.x1 + 6;
      o.push(`<path d="M ${(x + best.side * 19).toFixed(1)} ${y.toFixed(1)} L ${ax.toFixed(1)} ${best.ly.toFixed(1)}" stroke="${col}" stroke-width="1" opacity="0.45" fill="none"/>`);
    }
    o.push(`<text x="${best.b.x0.toFixed(1)}" y="${(best.ly + 5).toFixed(1)}" font-size="15" font-weight="${p.mine ? 700 : 500}" fill="${p.mine ? t.ink : t.dim}">${esc(name)}</text>`);
    o.push(`<text x="${(best.b.x0 + wName + 10).toFixed(1)}" y="${(best.ly + 5).toFixed(1)}" font-size="15" font-weight="700" fill="${col}">${esc(price)}</text>`);
  }

  const fy = H - 40;
  const notes = [
    `Answer key established on the day of the run by 8 independent systems, one vote per provider.`,
    `At n=${R.n} the horizontal axis carries about plus or minus 10 points. The vertical axis does not.`,
  ];
  notes.forEach((s, i) => o.push(`<text x="${L}" y="${fy + i * 18}" font-size="12" fill="${t.faint}">${esc(s)}</text>`));
  o.push('</svg>');
  return o.join('\n');
};

mkdirSync(`${ROOT}docs`, { recursive: true });
writeFileSync(`${ROOT}docs/scatter-dark.svg`, `${svg(THEMES.dark)}\n`);
writeFileSync(`${ROOT}docs/scatter-light.svg`, `${svg(THEMES.light)}\n`);
console.log('docs/scatter-dark.svg, docs/scatter-light.svg');
