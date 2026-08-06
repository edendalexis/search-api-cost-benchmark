// THE ARITHMETIC. Deliberately dumb and deliberately isolated: this is the one
// place where a number could be bent without anything else noticing, so it is
// small enough to read in full and it is recomputed from the published run by
// `report.mjs` on your machine.
//
// A search API bills you twice. Once at the door, per request. Then again, per
// token, when its payload lands in your agent's context window — and that
// second invoice is not printed on anyone's pricing page.
import { readFileSync } from 'node:fs';

export const PRICING = JSON.parse(
  readFileSync(new URL('../pricing.json', import.meta.url), 'utf8'),
);

const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

/** Reads a vendor's self-reported consumption out of one raw payload. */
export function reportedUnits(arm, raw) {
  const p = PRICING.arms[arm];
  if (!p?.usage_path) return null;
  try {
    const v = at(JSON.parse(raw), p.usage_path);
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

/** Dollars per single unit of whatever a subscription counts. */
const usdPerUnit = (p) => {
  if (p.billing === 'subscription') return p.usd_per_month / p.units_per_month;
  // A pay-as-you-go arm quotes a per-1k-request rate; one request is one unit.
  return p.usd_per_1k_requests / 1000 / (p.units_per_request ?? 1);
};

/**
 * What 1000 requests to this arm cost at the door.
 *
 * `meanUnits` is the average of what the vendor said it billed, across the run.
 * When it is available it WINS: a vendor's own meter beats our reading of its
 * pricing page. Firecrawl charges 2 credits per search, not the 1 you would
 * assume; Exa states the dollar figure outright.
 */
export function apiUsdPer1k(arm, meanUnits = null) {
  const p = PRICING.arms[arm];
  if (!p) throw new Error(`no pricing entry for arm "${arm}" — add one to pricing.json`);

  if (meanUnits != null && p.usage_path) {
    if (p.usage_unit === 'usd') return { usd: meanUnits * 1000, basis: 'self-reported (usd)' };
    return { usd: meanUnits * usdPerUnit(p) * 1000, basis: `self-reported (${p.usage_unit})` };
  }

  if (p.billing === 'subscription') {
    const usd = usdPerUnit(p) * (p.units_per_request ?? 1) * 1000;
    return { usd, basis: `${p.plan} plan, consumed in full` };
  }
  return { usd: p.usd_per_1k_requests, basis: p.billing === 'free_tier' ? 'free on every plan' : 'list pay-as-you-go' };
}

/** What 1000 requests' worth of payload costs once it enters the model. */
export function llmUsdPer1k(meanPromptTokens, model) {
  const m = PRICING.llms[model];
  if (!m) throw new Error(`no price for model "${model}" — add one to pricing.json`);
  return (meanPromptTokens * 1000 * m.usd_per_mtok_input) / 1e6;
}

/**
 * The headline. Cost of a thousand requests divided by how many of them come
 * back answerable — because a cheap request you cannot answer from is not
 * cheap, it is wasted.
 */
export function usdPerCorrect(totalUsdPer1k, correctRate) {
  if (!correctRate) return null; // nothing correct: the ratio is meaningless, not infinite
  return totalUsdPer1k / (1000 * correctRate);
}
