export interface Group {
  id: string;
  fb_id: string;
  url: string;
  name: string | null;
  enabled: boolean;
  last_checked_at: string | null;
  last_post_count: number;
  last_error: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  bgg_id: string | null;
  name: string;
  year: string | null;
  thumbnail: string | null;
  priority: number | null;
  aliases: string[];
  enabled: boolean;
  source: 'manual' | 'import' | 'bgg';
  created_at: string;
  rating?: number | null;
  weight?: number | null;
  bgg_rank?: number | null;
  min_players?: number | null;
  max_players?: number | null;
  best_players?: number[];
  rec_players?: number[];
  min_time?: number | null;
  max_time?: number | null;
  owned?: number | null;
  votes?: number | null;
}

export interface Match {
  id: string;
  game_id: string | null;
  game_name: string;
  thumbnail: string | null;
  group_id: string | null;
  group_name: string | null;
  url: string;
  exact_link: boolean;
  snippet: string | null;
  post_text?: string | null;
  images?: string[];
  line_games?: Record<string, string>;
  found_at: string;
  read: boolean;
  dismissed: boolean;
}

/** Any post the checker saw (wishlist hit or not). */
export interface FeedPost {
  id: string;
  group_id: string | null;
  group_name: string | null;
  url: string;
  exact_link: boolean;
  post_text: string | null;
  images: string[];
  line_games: Record<string, string>;
  found_at: string;
  /** Real Facebook post time, when known. */
  posted_at?: string | null;
  dismissed: boolean;
}

export interface CheckerStatus {
  state?: 'idle' | 'scanning';
  heartbeatAt?: string;
  pc?: string;
  fbConnected?: boolean;
  lastScanAt?: string;
  lastScanStartedAt?: string;
  nextScanAt?: string | null;
  progress?: { done: number; total: number; current?: string } | null;
  lastError?: string | null;
  lastSummary?: { groups: number; posts: number; found: number };
}

export interface Settings {
  id: 1;
  interval_minutes: number;
  scan_depth: 'light' | 'normal' | 'deep';
  paused: boolean;
  bgg_username: string | null;
  check_requested_at: string | null;
  bgg_sync_requested_at: string | null;
  bgg_sync_result: string | null;
  accent?: string | null;
  checker_status: CheckerStatus;
}

/** Stats shown in the info card (from a wishlist game, BGG's ranks file, or the BGG API). */
export interface GameStats {
  name: string;
  year?: string | null;
  bgg_id?: string | null;
  rating?: number | null;
  weight?: number | null;
  bgg_rank?: number | null;
  min_players?: number | null;
  max_players?: number | null;
  best_players?: number[];
  rec_players?: number[];
  min_time?: number | null;
  max_time?: number | null;
  owned?: number | null;
  votes?: number | null;
}

export interface Data {
  groups: Group[];
  games: Game[];
  matches: Match[];
  posts: FeedPost[];
  settings: Settings;
  bgg: Record<string, GameStats>;
}

/** Wishlist game + any extra stats known for it (non-empty values win). */
export function mergeStats(base: GameStats | undefined, extra: GameStats | undefined): GameStats | undefined {
  if (!base) return extra;
  if (!extra) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k];
    const empty = cur == null || (Array.isArray(cur) && !cur.length);
    if (empty && v != null) out[k] = v;
  }
  return out as unknown as GameStats;
}

export type Table = 'groups' | 'games' | 'matches' | 'posts';
