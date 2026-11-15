import type { Data, FeedPost, Game, Group, Match } from './types';

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export function demoData(): Data {
  const games: Game[] = [
    ['Brass: Birmingham', '2018', 1], ['Ark Nova', '2021', 1], ['Spirit Island', '2017', 2],
    ['Root', '2018', 2], ['Wingspan', '2019', 3], ['Twilight Imperium: Fourth Edition', '2017', 4],
  ].map(([name, year, priority], i) => ({
    id: `g${i}`, bgg_id: null, name: name as string, year: year as string, thumbnail: null,
    priority: priority as number, aliases: i === 4 ? ['Φτερούγες'] : [], enabled: true, source: 'manual', created_at: ago(1000),
  }));
  Object.assign(games[0], { bgg_id: '224517', rating: 8.6, weight: 3.87, bgg_rank: 1, min_players: 2, max_players: 4, best_players: [3, 4], rec_players: [2, 3, 4], min_time: 60, max_time: 120, owned: 74210 });
  Object.assign(games[1], { bgg_id: '342942', rating: 8.5, weight: 3.77, bgg_rank: 3, min_players: 1, max_players: 4, best_players: [2], rec_players: [1, 2, 3], min_time: 90, max_time: 150, owned: 61200 });
  const groups: Group[] = [
    { id: 'gr1', fb_id: 'boardgames.gr.market', url: 'https://www.facebook.com/groups/boardgames.gr.market/', name: 'Board Games Greece – Buy & Sell', enabled: true, last_checked_at: ago(6), last_post_count: 42, last_error: null, created_at: ago(2000) },
    { id: 'gr2', fb_id: '1234567890', url: 'https://www.facebook.com/groups/1234567890/', name: 'Επιτραπέζια – Αγοραπωλησίες', enabled: true, last_checked_at: ago(6), last_post_count: 38, last_error: null, created_at: ago(2000) },
    { id: 'gr3', fb_id: 'eurogames', url: 'https://www.facebook.com/groups/eurogames/', name: 'Eurogames Marketplace', enabled: false, last_checked_at: ago(300), last_post_count: 0, last_error: 'No posts visible. Are you a member of this group?', created_at: ago(2000) },
  ];
  const m = (i: number, g: number, gr: number, min: number, snippet: string, read = false): Match => ({
    id: `m${i}`, game_id: games[g].id, game_name: games[g].name, thumbnail: null, group_id: groups[gr].id,
    group_name: groups[gr].name, url: groups[gr].url, exact_link: true, snippet, found_at: ago(min), read, dismissed: false,
  });
  const matches: Match[] = [
    {
      ...m(1, 0, 0, 4, ''),
      post_text: 'Νίκος Παπαδόπουλος\nΠωλούνται τα παρακάτω, όλα σε άριστη κατάσταση:\n1) Brass Birmingham Deluxe - 85€\n2) Patchwork Ελληνικό 10€ (ΠΟΥΛΗΘΗΚΕ)\n3) Cascadia: 25€\n4) Ark Nova σφραγισμένο 55€\n- Azul €20\n• Ticket to Ride Europe – 30 ευρώ\nΠαράδοση Αθήνα ή αποστολή με BoxNow\n€85 · ΑΘΉΝΑ',
      images: ['https://picsum.photos/seed/meeple1/600/400', 'https://picsum.photos/seed/meeple2/600/400', 'https://picsum.photos/seed/meeple3/600/400'],
    },
    { ...m(5, 1, 0, 4, ''), id: 'm1|g1' }, // same post, second game (Ark Nova)
    m(2, 4, 1, 32, 'Selling Wingspan + European expansion, all cards sleeved · 40€ for both'),
    m(3, 1, 0, 180, 'Ark Nova sealed in shrink · 55€ · pickup Thessaloniki', true),
    m(4, 3, 1, 1440, 'Root with Riverfolk + Underworld · swaps welcome', true),
  ];
  matches[0].line_games = { '3) Cascadia: 25€': '295947', '- Azul €20': '230802', '1) Brass Birmingham Deluxe - 85€': '224517', '4) Ark Nova σφραγισμένο 55€': '342942' };
  const bgg = {
    '295947': { bgg_id: '295947', name: 'Cascadia', year: '2021', bgg_rank: 50, rating: 7.9, votes: 52000 },
    '230802': { bgg_id: '230802', name: 'Azul', year: '2017', bgg_rank: 85, rating: 7.7, votes: 110000, weight: 1.76, min_players: 2, max_players: 4, best_players: [2], rec_players: [2, 3, 4], min_time: 30, max_time: 45 },
  };
  const fp = (id: string, gr: number, min: number, post_text: string, images: string[] = []): FeedPost => ({
    id, group_id: groups[gr].id, group_name: groups[gr].name, url: groups[gr].url, exact_link: true,
    post_text, images, line_games: {}, found_at: ago(min), dismissed: false,
  });
  const posts: FeedPost[] = [
    fp('p1', 1, 12, 'Γιώργος Κ.\nΞεκαθάρισμα συλλογής!\nCodenames 12\nDixit 18\nCarcassonne + Inns & Cathedrals 25\nSplendor 15 (ΠΟΥΛΗΘΗΚΕ)\nΠαραλαβή Πειραιάς', ['https://picsum.photos/seed/meeple4/600/400']),
    fp('p5', 0, 20, 'Κώστας Μ.\nΠωλούνται όλα μαζί ή χωριστά\nGloomhaven 90€\nNemesis 80€\nDune Imperium 35€', [1, 2, 3, 4, 5, 6].map((n) => `https://picsum.photos/seed/mwcar${n}/800/600`)),
    fp('p2', 0, 95, 'Maria S.\nLooking for Gloomhaven: Jaws of the Lion, in good condition. Thessaloniki area preferred, can also pay shipping.'),
    fp('p3', 1, 60 * 30, 'Δημήτρης Α.\nΠωλείται Terraforming Mars με Prelude 40€\nΆψογη κατάσταση, παίχτηκε 3 φορές'),
    fp('p4', 0, 60 * 52, 'Eleni P.\nAuction ends Sunday 21:00\nStarting price 10€\nScythe 35€\nViticulture Essential 30€\nPandemic 15€\nAzul 20€\nKingdomino 10€\nSagrada 18€\nThe Crew 8€\nJust One 12€\nCamel Up 16€\nHanabi 6€', ['https://picsum.photos/seed/meeple5/600/400', 'https://picsum.photos/seed/meeple6/600/400']),

  ];
  return {
    groups, games, matches, posts, bgg,
    settings: {
      id: 1, interval_minutes: 30, scan_depth: 'normal', paused: false, bgg_username: '',
      check_requested_at: null, bgg_sync_requested_at: null, bgg_sync_result: null,
      checker_status: {
        state: 'idle', heartbeatAt: new Date(Date.now() + 3600_000).toISOString(), pc: 'DESKTOP-PC', fbConnected: true,
        lastScanAt: ago(6), lastScanStartedAt: ago(7), nextScanAt: new Date(Date.now() + 24 * 60_000).toISOString(),
        lastSummary: { groups: 2, posts: 80, found: 1 }, lastError: null,
      },
    },
  };
}
