import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Loads .env / .env.local without a dependency. Existing variables win. */
export function loadEnv(dir = process.cwd()) {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
        const eq = line.indexOf('=');
        if (eq < 1 || line.startsWith('#')) continue;
        const k = line.slice(0, eq).trim();
        if (!process.env[k]) process.env[k] = line.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1');
      }
    } catch { /* no file: variables come from the environment */ }
  }
}
