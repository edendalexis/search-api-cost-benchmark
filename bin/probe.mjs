// One real query per arm. Validates the key, the request body and the shape of
// what comes back, and prints the payload volume — the number this whole
// benchmark is built around. Costs one request per arm.
//
// Usage: node bin/probe.mjs [--query="..."] [--arms=a,b]
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnv } from '../lib/env.mjs';
import { PROVIDERS, callArm, forAgent } from '../lib/providers.mjs';

loadEnv(new URL('..', import.meta.url).pathname);

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).slice(n.length + 3);
const QUERY = arg('query', 'Who won the 2024 Nobel Prize in Physics?');
const ARMS = arg('arms', '').split(',').filter(Boolean);
const list = (ARMS.length ? ARMS : Object.keys(PROVIDERS)).sort();

mkdirSync(new URL('../probe/', import.meta.url), { recursive: true });
console.log(`probing ${list.length} arms — "${QUERY}"\n`);
console.log(`${'arm'.padEnd(20)} ${'status'.padEnd(7)} ${'wall'.padStart(6)} ${'srv'.padStart(6)} ${'bytes'.padStart(8)}  ~tokens  top-level keys`);
console.log('-'.repeat(96));

for (const arm of list) {
  const key = process.env[PROVIDERS[arm].envKey];
  if (!key) { console.log(`${arm.padEnd(20)} NO KEY  (${PROVIDERS[arm].envKey})`); continue; }

  const r = await callArm(arm, QUERY, key, { retries: 0 });
  const body = forAgent(arm, r.raw);
  let keys = '';
  try {
    const j = JSON.parse(body);
    keys = Array.isArray(j) ? `[array of ${j.length}]` : Object.keys(j).join(', ');
  } catch { keys = '(not JSON)'; }

  console.log(
    `${arm.padEnd(20)} ${String(r.status).padEnd(7)} ${String(r.wall_ms).padStart(6)} ${String(r.server_ms ?? '-').padStart(6)} ${String(body.length).padStart(8)}  ${String(Math.round(body.length / 4)).padStart(7)}  ${keys.slice(0, 60)}`,
  );
  writeFileSync(new URL(`../probe/${arm}.json`, import.meta.url), body);
  if (!r.ok) console.log(`${' '.repeat(20)} └─ ${r.raw.slice(0, 160).replace(/\s+/g, ' ')}`);
  await new Promise((s) => setTimeout(s, 700));
}

console.log('\nraw payloads written to probe/ — inspect before wiring the run');
