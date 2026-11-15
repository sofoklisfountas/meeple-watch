# Meeple Watch

Finds your wishlist board games in Facebook buy/sell groups.

- **website** (`web/`): React app. Free on GitHub Pages. Installs on your phone.
- **checker** (`checker/`): runs hidden on your PC. Reads your groups, saves matches.
- **database**: Supabase (free).

---

## Setup (about 15 min)

### 1. Supabase
1. Sign up at supabase.com → **New project**.
2. **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up".
4. **Authentication → Users → Add user** → your email + a password → tick **Auto confirm**.
5. **Project Settings → API Keys** → keep this tab open. You need:
   - Project URL
   - Publishable key (for the website)
   - Secret key (for the checker, never share it)

### 2. Checker on your PC
1. Double-click `checker/setup.cmd`.
2. Paste the Project URL and **Secret** key.
3. A browser opens → log into Facebook → it closes by itself.

Done. It starts with Windows, hidden.

| File | What it does |
|---|---|
| `connect-facebook.cmd` | Log into Facebook again |
| `stop-checker.cmd` | Stop the checker |
| `start-hidden.vbs` | Start it again |

Log: `%LOCALAPPDATA%\MeepleWatch\checker.log`

### 3. Website on GitHub Pages
1. Create a GitHub repo and push this folder.
2. Repo **Settings → Secrets and variables → Actions** → add:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = **Publishable** key
3. Repo **Settings → Pages** → Source: **GitHub Actions**.
4. Open `https://<your-github-name>.github.io/<repo-name>/` and sign in.

### 4. Phone
Open the site in Chrome → menu → **Add to Home screen**.

---

## Use it
- **Groups**: paste group links (you must be a member).
- **Wishlist**: paste names, import a BGG CSV, or **BGG sync**.
  - BGG sync needs a BGG API token in `checker/.env` (`BGG_TOKEN=`). Without it, use CSV: BGG → Collection → Export.
- **Other names**: tap a game to add Greek titles or short names.

## Local development
```bash
cd web && npm install && npm run dev
```
No `web/.env` = demo mode with sample data. Copy `web/.env.example` to `web/.env` to use your real data.

Tests: `cd checker && npm test`
