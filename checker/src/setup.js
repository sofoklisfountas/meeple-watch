// One-time setup: saves your Supabase keys, adds the checker to Windows startup, connects Facebook.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { ROOT, ENV_FILE, DATA_DIR, env } from './config.js';
import { makeDb } from './db.js';

const rl = readline.createInterface({ input: stdin, output: stdout });
const ask = async (question, current) => {
  const a = (await rl.question(`${question}${current ? ' [press Enter to keep current]' : ''}: `)).trim();
  return a || current || '';
};

console.log('\n=== Meeple Watch checker setup ===\n');
console.log('Find these in Supabase > Project Settings > API Keys.\n');

const setupLog = path.join(DATA_DIR, 'setup.log');
const note = (msg) => fs.appendFileSync(setupLog, `[${new Date().toISOString()}] ${msg}\n`);

let url = await ask('1) Project URL (https://xxxx.supabase.co)', env.url);
try { url = new URL(url.trim()).origin; } catch {} // drop any /rest/v1 or trailing slash
const key = (await ask('2) Secret key (sb_secret_... or service_role)', env.key)).trim();
const bgg = await ask('3) BGG API token (optional, Enter to skip)', env.bggToken);
note(`url=${url} keyStart=${key.slice(0, 10)} keyLength=${key.length}`);

if (key.startsWith('sb_publishable')) {
  console.log('\nThat is the PUBLISHABLE key. The checker needs the SECRET key (sb_secret_...).');
  note('FAILED: publishable key given');
  process.exit(1);
}

process.stdout.write('\nTesting connection... ');
try {
  const { error } = await makeDb(url, key).from('settings').select('id').eq('id', 1).single();
  if (error) throw new Error(error.message);
  console.log('OK ✓');
  note('connection OK');
} catch (e) {
  console.log(`FAILED: ${e.message}`);
  console.log('Check the URL/key and that you ran supabase/schema.sql. Then run setup again.');
  note(`FAILED: ${e.message}`);
  process.exit(1);
}

fs.writeFileSync(ENV_FILE, `SUPABASE_URL=${url}\nSUPABASE_SERVICE_KEY=${key}\nBGG_TOKEN=${bgg}\n`);
console.log('Saved settings ✓');

// Start with Windows (hidden).
const vbs = path.join(ROOT, 'start-hidden.vbs');
const lnk = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'Meeple Watch Checker.lnk');
const ps = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${lnk.replace(/'/g, "''")}');` +
  `$s.TargetPath='wscript.exe';$s.Arguments='"${vbs}"';$s.WorkingDirectory='${ROOT.replace(/'/g, "''")}';$s.Save()`;
const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
console.log(r.status === 0 ? 'Added to Windows startup ✓' : 'Could not add to startup (you can run start-hidden.vbs manually).');

const fbNow = (await rl.question('\nLog into Facebook now? (Y/n): ')).trim().toLowerCase();
rl.close();
if (fbNow !== 'n') spawnSync(process.execPath, [path.join(ROOT, 'src', 'login.js')], { stdio: 'inherit' });

spawn('wscript.exe', [vbs], { detached: true, stdio: 'ignore' }).unref();
console.log('\nChecker is running in the background ✓');
console.log('Open your Meeple Watch website to add groups and games.\n');
