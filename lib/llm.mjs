// One exit point to the models: OpenRouter. A single access provider so no
// vendor gets an edge from a first-party SDK, a different default, or a
// different version — and so you can swap the model with one flag.
//
// `ask` returns the text AND the usage block. The prompt token count is the
// whole point of this benchmark: it is the invoice, not an estimate from a
// tokenizer we chose.

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export async function ask(model, prompt, { retries = 3, timeoutMs = 180000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0 }),
        signal: ac.signal,
      });
      if (r.status === 429 || r.status >= 500) throw new Error(`http ${r.status}`);
      const d = await r.json();
      const text = d?.choices?.[0]?.message?.content;
      if (!text) throw new Error(`empty response from ${model}: ${JSON.stringify(d).slice(0, 160)}`);
      return {
        text: text.trim(),
        // OpenRouter mirrors the upstream usage block. `prompt_tokens` is what
        // the agent would be billed for on this exact payload.
        prompt_tokens: d?.usage?.prompt_tokens ?? null,
        completion_tokens: d?.usage?.completion_tokens ?? null,
      };
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((s) => setTimeout(s, 2000 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Concurrency limiter — runs are large and providers have quotas. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}
