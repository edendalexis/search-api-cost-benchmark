// THE ARMS.
//
// An arm is not a vendor — it is a vendor in ONE PRICED CONFIGURATION. Tavily
// basic and Tavily advanced do not cost the same and do not return the same
// volume of tokens, so they are two arms. That is the unit this benchmark
// measures, because it is the unit you are billed on.
//
// `call` returns the RAW HTTP body, verbatim. That string is what goes into the
// answering LLM's prompt, and therefore what the token count is taken on.
//
// EVERY ARM RUNS ITS VENDOR'S DOCUMENTED DEFAULT. No tuning, no result-count
// normalisation, no format flags. If one vendor's default returns ten results
// and another's returns five, that difference is the product decision — and
// pricing it is the entire point of this benchmark.
//
// ADDING YOURS IS TEN LINES. Add an entry below, add its price to
// pricing.json with a source URL, and run. Pull requests welcome, including
// ones that beat the arms already here.

export const PROVIDERS = {
  'brave-search': {
    vendor: 'Brave',
    envKey: 'BRAVE_API_KEY',
    docs: 'https://api-dashboard.search.brave.com/app/documentation/web-search/get-started',
    async call(query, key) {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;
      return fetch(url, {
        headers: { 'X-Subscription-Token': key, accept: 'application/json' },
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  // THE ONE PLACE WE DEPART FROM THE BARE DEFAULT, AND WHY.
  //
  // Exa's default response carries `id`, `title` and `url` — no snippet, no
  // text. There is nothing in it for a model to answer from, so benchmarking it
  // would score Exa at zero on a setting nobody ships. `contents: {text: true}`
  // returns the page text, and Exa's own `costDollars` reports the SAME
  // $0.007 either way: the content is not billed extra. Running the richer
  // configuration is the reading favourable to them, at no change in price.
  'exa-search': {
    vendor: 'Exa',
    envKey: 'EXA_API_KEY',
    docs: 'https://docs.exa.ai/reference/search',
    async call(query, key) {
      return fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ query, contents: { text: true } }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'firecrawl-search': {
    vendor: 'Firecrawl',
    envKey: 'FIRECRAWL_API_KEY',
    docs: 'https://docs.firecrawl.dev/api-reference/endpoint/search',
    async call(query, key) {
      return fetch('https://api.firecrawl.dev/v2/search', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'linkup-standard': {
    vendor: 'Linkup',
    envKey: 'LINKUP_API_KEY',
    docs: 'https://docs.linkup.so/pages/documentation/endpoints/search/reference',
    async call(query, key) {
      return fetch('https://api.linkup.so/v1/search', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        // `sourcedAnswer` is their synthesis; `searchResults` is the material,
        // which is what every other arm here returns.
        body: JSON.stringify({ q: query, depth: 'standard', outputType: 'searchResults' }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  // Parallel's Search API is ONE endpoint with three priced modes — three arms,
  // for the same reason Tavily's two depths are two arms.
  //
  // Two traps, both verified against the live endpoint rather than the docs:
  //   • the endpoint is /v1/search. /v1beta/search and /alpha/search also answer,
  //     but they take a different `mode` vocabulary (agentic/fast/one-shot) and
  //     are not what the pricing page prices.
  //   • the field is `mode`. Sending `processor` (which belongs to their Task API)
  //     returns 200 and is SILENTLY IGNORED — every arm then measures the default
  //     mode while appearing to work.
  // /v1/search requires `search_queries`; `objective` carries the question as an
  // agent would phrase it, and both are sent.
  'parallel-turbo': {
    vendor: 'Parallel',
    envKey: 'PARALLEL_API_KEY',
    docs: 'https://docs.parallel.ai/search/modes',
    async call(query, key) {
      return fetch('https://api.parallel.ai/v1/search', {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ objective: query, search_queries: [query], mode: 'turbo' }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'parallel-basic': {
    vendor: 'Parallel',
    envKey: 'PARALLEL_API_KEY',
    docs: 'https://docs.parallel.ai/search/modes',
    async call(query, key) {
      return fetch('https://api.parallel.ai/v1/search', {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ objective: query, search_queries: [query], mode: 'basic' }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'parallel-advanced': {
    vendor: 'Parallel',
    envKey: 'PARALLEL_API_KEY',
    docs: 'https://docs.parallel.ai/search/modes',
    async call(query, key) {
      return fetch('https://api.parallel.ai/v1/search', {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ objective: query, search_queries: [query], mode: 'advanced' }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'serpdive-krill': {
    vendor: 'SERPdive',
    envKey: 'SERPDIVE_API_KEY',
    docs: 'https://serpdive.com/docs',
    async call(query, key) {
      return fetch('https://api.serpdive.com/v1/search', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query, model: 'krill' }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'serpdive-mako': {
    vendor: 'SERPdive',
    envKey: 'SERPDIVE_API_KEY',
    docs: 'https://serpdive.com/docs',
    async call(query, key) {
      return fetch('https://api.serpdive.com/v1/search', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query, model: 'mako' }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'serpdive-moby': {
    vendor: 'SERPdive',
    envKey: 'SERPDIVE_API_KEY',
    docs: 'https://serpdive.com/docs',
    async call(query, key) {
      return fetch('https://api.serpdive.com/v1/search', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query, model: 'moby' }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'tavily-basic': {
    vendor: 'Tavily',
    envKey: 'TAVILY_API_KEY',
    docs: 'https://docs.tavily.com/documentation/api-reference/endpoint/search',
    async call(query, key) {
      return fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query, search_depth: 'basic' }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'tavily-advanced': {
    vendor: 'Tavily',
    envKey: 'TAVILY_API_KEY',
    docs: 'https://docs.tavily.com/documentation/api-reference/endpoint/search',
    async call(query, key) {
      return fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query, search_depth: 'advanced' }),
        signal: AbortSignal.timeout(60000),
      });
    },
  },

  'you-web': {
    vendor: 'You.com',
    envKey: 'YOU_API_KEY',
    docs: 'https://you.com/docs/api-reference/search',
    async call(query, key) {
      const url = `https://ydc-index.io/v1/search?query=${encodeURIComponent(query)}`;
      return fetch(url, {
        headers: { 'X-API-Key': key },
        signal: AbortSignal.timeout(60000),
      });
    },
  },
};

/**
 * TWO LATENCIES, RECORDED FOR EVERY REQUEST.
 *
 * `wall_ms` is ours: the clock runs from the moment we send to the moment we
 * have the body. Every arm gets it, same machine, same conditions. It is the
 * number that matches what an agent actually waits for, and it is the one to
 * compare arms on.
 *
 * `server_ms` is a bonus: the figure the vendor states inside its own payload,
 * in whatever unit it chose, converted to milliseconds. Several arms report
 * nothing at all — those stay `null` rather than get an invented value.
 *
 * Optional table — an arm with no entry here still gets its wall time.
 */
const SERVER_MS = {
  'serpdive-krill': (j) => (typeof j.response_time_ms === 'number' ? Math.round(j.response_time_ms) : null),
  'serpdive-mako': (j) => (typeof j.response_time_ms === 'number' ? Math.round(j.response_time_ms) : null),
  'serpdive-moby': (j) => (typeof j.response_time_ms === 'number' ? Math.round(j.response_time_ms) : null),
  // Tavily reports seconds. A reported 0 is their cache answering, not a
  // zero-cost search — see METHOD.md on call ordering within a vendor.
  'tavily-basic': (j) => (typeof j.response_time === 'number' ? Math.round(j.response_time * 1000) : null),
  'tavily-advanced': (j) => (typeof j.response_time === 'number' ? Math.round(j.response_time * 1000) : null),
  'you-web': (j) => (typeof j?.metadata?.latency === 'number' ? Math.round(j.metadata.latency * 1000) : null),
  // Exa reports `searchTime`, unit undocumented and not plausibly the whole
  // request. Recorded as given, in their unit, and not compared to the others.
  'exa-search': (j) => (typeof j.searchTime === 'number' ? j.searchTime : null),
};

/**
 * The vendors' own SYNTHESES are out of scope on every side: we compare the
 * material brought back, not the summariser sitting on top of it. Only the
 * fields listed here are stripped, the rest of the payload ships verbatim —
 * including fields that flatter the vendor, such as Tavily's `score`.
 */
const SYNTHESIS_FIELDS = {
  'serpdive-krill': ['verdict'],
  'serpdive-mako': ['verdict'],
  'serpdive-moby': ['verdict'],
  'tavily-basic': ['answer'],
  'tavily-advanced': ['answer'],
};

/** What the answering LLM reads: the payload verbatim, minus the synthesis. */
export function forAgent(arm, raw) {
  const fields = SYNTHESIS_FIELDS[arm];
  if (!fields) return raw;
  try {
    const obj = JSON.parse(raw);
    for (const f of fields) delete obj[f];
    return JSON.stringify(obj);
  } catch {
    return raw; // unreadable: passed as is rather than "repaired"
  }
}

/**
 * MINIMUM SPACING BETWEEN TWO CALLS TO THE SAME ARM.
 *
 * Free tiers cap requests per minute, and outrunning that cap produces 429s
 * that say nothing about the product. Firecrawl's tier tops out near 20/min
 * and returned 24 of them on the first attempt at 400 ms spacing — a failure
 * rate that was ours, not theirs. Pace to what the tier allows.
 */
export const PACE_MS = {
  'firecrawl-search': 4000,
};
export const paceFor = (arm) => PACE_MS[arm] ?? 400;

/** How long the vendor asked us to wait — its header, or its own error text. */
function retryAfterMs(res, body) {
  const h = res?.headers?.get?.('retry-after');
  if (h && !Number.isNaN(Number(h))) return Number(h) * 1000;
  const m = /retry after (\d+)\s*s/i.exec(body || '');
  return m ? Number(m[1]) * 1000 : null;
}

/**
 * One call, with retries on transient failures only. A request that fails for
 * good is NOT dropped: it is returned with its status and counted. You paid for
 * it, so the benchmark charges you for it.
 *
 * A 429 is the deliberate exception. It means WE went too fast for the tier,
 * not that the vendor broke — so it waits out the vendor's own Retry-After and
 * tries again, and gets more attempts, instead of being scored as a defect.
 */
export async function callArm(arm, query, key, { retries = 2, rateLimitRetries = 5 } = {}) {
  const p = PROVIDERS[arm];
  const serverOf = (raw) => {
    const f = SERVER_MS[arm];
    if (!f) return null;
    try { return f(JSON.parse(raw)); } catch { return null; }
  };
  let attempt = 0;
  let throttled = 0;
  for (;;) {
    const t0 = Date.now();
    try {
      const r = await p.call(query, key);
      const raw = await r.text();
      const wall_ms = Date.now() - t0;
      if (r.ok) return { ok: true, status: r.status, raw, wall_ms, server_ms: serverOf(raw) };

      if (r.status === 429 && throttled < rateLimitRetries) {
        // Honour what they asked for, with a floor — a 1.5 s backoff against a
        // "retry after 16s" just burns another request against the same cap.
        const wait = Math.max(retryAfterMs(r, raw) ?? 0, 5000 * (throttled + 1));
        throttled++;
        await new Promise((s) => setTimeout(s, wait));
        continue;
      }
      if (attempt >= retries || (r.status < 500 && r.status !== 429)) {
        return { ok: false, status: r.status, raw, wall_ms, server_ms: null };
      }
    } catch (e) {
      if (attempt >= retries) {
        return { ok: false, status: 0, raw: String(e.message), wall_ms: Date.now() - t0, server_ms: null };
      }
    }
    attempt++;
    await new Promise((s) => setTimeout(s, 1500 * attempt));
  }
}
