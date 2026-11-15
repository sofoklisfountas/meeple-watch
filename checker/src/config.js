import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_FILE = path.join(ROOT, '.env');
dotenv.config({ path: ENV_FILE, quiet: true });

// Browser profile (your Facebook login) and logs live here, never in the project folder.
export const DATA_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), 'MeepleWatch');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const PROFILE_DIR = path.join(DATA_DIR, 'firefox-profile');
export const LOG_FILE = path.join(DATA_DIR, 'checker.log');
export const PID_FILE = path.join(DATA_DIR, 'checker.pid');
export const LOGIN_LOCK = path.join(DATA_DIR, 'login.lock');

export const env = {
  url: process.env.SUPABASE_URL || '',
  key: process.env.SUPABASE_SERVICE_KEY || '',
  bggToken: process.env.BGG_TOKEN || '',
};

export const SCROLLS = { light: 3, normal: 6, deep: 12 };

export function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}`;
  console.log(line);
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 2_000_000) fs.renameSync(LOG_FILE, LOG_FILE + '.old');
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {}
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
