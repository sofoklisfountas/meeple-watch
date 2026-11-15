// Applies new files from supabase/migrations/ (in name order) that haven't run yet.
// Runs automatically when the checker starts; can also be run by hand: node src/migrate.js
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeDb } from './db.js';
import { ROOT, log } from './config.js';
import { runSql } from './sql.js';

const DIR = path.join(ROOT, '..', 'supabase', 'migrations');

export async function migrate(db = makeDb()) {
  const { data: done, error } = await db.from('migrations').select('name');
  if (error) {
    log(`Migrations skipped: ${error.message} (run supabase/enable-auto-updates.sql once)`);
    return;
  }
  const applied = new Set(done.map((d) => d.name));
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort() : [];
  for (const f of files.filter((f) => !applied.has(f))) {
    const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
    if (process.env.SUPABASE_ACCESS_TOKEN) {
      await runSql(`${sql}\nnotify pgrst, 'reload schema';`);
    } else {
      const { error: e1 } = await db.rpc('run_sql', { query: sql });
      if (e1) throw new Error(`Migration ${f} failed: ${e1.message}`);
      await db.rpc('run_sql', { query: "notify pgrst, 'reload schema'" });
    }
    await db.from('migrations').insert({ name: f });
    log(`Applied migration ${f}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await migrate();
  console.log('Migrations up to date.');
}
