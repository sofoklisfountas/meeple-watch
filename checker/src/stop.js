import fs from 'node:fs';
import { PID_FILE } from './config.js';

try {
  const pid = Number(fs.readFileSync(PID_FILE, 'utf8'));
  process.kill(pid);
  fs.unlinkSync(PID_FILE);
  console.log('Checker stopped.');
} catch {
  console.log('Checker is not running.');
}
