// One-off: fill prices for every game now (normally done after each check, 60 games at a time).
import { makeDb } from './db.js';
import { refreshPrices } from './prices.js';
await refreshPrices(makeDb(), { max: 2000 });
process.exit(0);
