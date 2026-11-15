// Runs SQL on THIS project only (ref taken from SUPABASE_URL), via the Supabase Management API.
// Usage: node src/sql.js <file.sql>   or   node src/sql.js -e "select 1"
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { env } from './config.js';

export function projectRef() {
  const m = new URL(env.url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
  if (!m) throw new Error('Cannot read project ref from SUPABASE_URL');
  return m[1];
}

export async function runSql(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || token.startsWith('paste-')) throw new Error('No SUPABASE_ACCESS_TOKEN in checker/.env');
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef()}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`SQL failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2];
  const query = arg === '-e' ? process.argv[3] : fs.readFileSync(arg, 'utf8');
  console.log(JSON.stringify(await runSql(query), null, 1));
}
