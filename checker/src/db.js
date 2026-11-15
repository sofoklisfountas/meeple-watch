import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { env } from './config.js';

export function makeDb(url = env.url, key = env.key) {
  if (!url || !key) throw new Error('Missing Supabase settings. Run setup.cmd first.');
  try { url = new URL(url.trim()).origin; } catch {} // accept ".../rest/v1/" too
  return createClient(url, key.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket }, // Node 20 has no built-in WebSocket
  });
}

/** Throws on Supabase error, returns data. */
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`Database: ${error.message}`);
  return data;
}
