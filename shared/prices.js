// New (shop) price for a game, from the boardgameprices.eu API answer. Fixed rules only (no AI).
// Product price only (no shipping). Order: Greek shop in stock → Greek shop → any shop in stock → any shop.

export const PRICE_API = 'https://boardgameprices.eu/api/info';

/** API url for one BGG id (prices in EUR). */
export function priceUrl(bggId) {
  return `${PRICE_API}?eid=${encodeURIComponent(bggId)}&currency=EUR&destination=GR&sitename=meeplewatch`;
}

/** Picks the price to show from the API answer. Always returns a row (price null = no shop). */
export function pickPrice(bggId, answer) {
  const items = (answer?.items || []).filter((it) => String(it.external_id) === String(bggId));
  const offers = items.flatMap((it) => it.prices || [])
    .map((p) => ({ price: Number(p.product), country: p.country || null, in_stock: p.stock === 'Y' }))
    .filter((p) => p.price > 0);
  const gr = offers.filter((p) => p.country === 'GR');
  const cheapest = (list) => list.sort((a, b) => a.price - b.price)[0];
  const best = cheapest(gr.filter((p) => p.in_stock)) || cheapest(gr) || cheapest(offers.filter((p) => p.in_stock)) || cheapest(offers);
  const url = items[0]?.url ? String(items[0].url).split('?')[0] : null;
  return {
    bgg_id: String(bggId),
    price: best ? Math.round(best.price * 100) / 100 : null,
    country: best?.country ?? null,
    in_stock: best?.in_stock ?? null,
    url,
    shops: offers.length,
    gr_shops: gr.length,
  };
}

/** How much cheaper the used price is (0.25 = 25% below new). null when unknown. */
export function saving(used, newPrice) {
  if (!(used > 0) || !(newPrice > 0)) return null;
  return 1 - used / newPrice;
}
