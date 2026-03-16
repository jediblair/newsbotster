# The Daily Digest — Project Reference

A self-hosted news aggregator presenting articles in a classic newspaper layout with AI-powered political bias and topic classification. Runs entirely in Docker.

---

## Architecture

### Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Web app | Next.js 14 (App Router, TypeScript) | Bootstrap 5 + Tailwind CSS |
| Database | PostgreSQL 16 | Schema in `db/init.sql` |
| Ingestion worker | Node.js 20 + TypeScript | RSS + cheerio scraper |
| Classifier worker | Node.js 20 + TypeScript | Ollama → Claude Haiku fallback |
| LLM | Ollama (`llama3.2`) | Local; Claude Haiku fallback via API |
| Reverse proxy | nginx Alpine | Rate limiting, security headers |
| Containerisation | Docker Compose v2 | 6 services |

### Docker Services & Networks

```
                            ┌──────────────────────────────────────────────┐
                            │               Docker Networks                │
                            │                                              │
┌──────────┐               │  ┌──────────┐      ┌──────────────────────┐ │
│  User    │◀──────────────┼──│  nginx   │◀─────│  Next.js (web)       │ │
│ Browser  │   :5333       │  │  :80     │      │  :3000               │ │
└──────────┘               │  └──────────┘      └──────────────────────┘ │
                            │                              │               │
                            │                             ▼               │
                            │  ┌───────────────────────────────────────┐  │
                            │  │          PostgreSQL :5432             │  │
                            │  └───────────────────────────────────────┘  │
                            │        ▲                    ▲               │
                            │        │                    │               │
                            │  ┌─────┴──────┐      ┌─────┴──────┐        │
                            │  │ Ingestion  │      │ Classifier │        │
                            │  │  Worker    │      │   Worker   │        │
                            │  └────────────┘      └────────────┘        │
                            │        │                    │               │
                            │  (internet)          ┌─────┴──────┐        │
                            │                      │   Ollama   │        │
                            │                      │  :11434    │        │
                            │                      └────────────┘        │
                            └──────────────────────────────────────────────┘
```

**Network isolation:**
- `nginx` + `web` — `frontend` network (public-facing)
- `web` + `postgres` + `classifier` + `ollama` — `backend` network (internal only)
- `ingestion` — `backend` + outbound internet (the only service with external access)

---

## Database Schema

### `articles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `source_id` | INT FK → `sources` | Cascade delete |
| `title` | TEXT | Not null |
| `summary` | TEXT | RSS summary / lede |
| `content` | TEXT | Full scraped body |
| `url` | TEXT | Unique |
| `url_hash` | VARCHAR(64) | SHA-256 for dedup |
| `image_url` | TEXT | Static image only — video URLs filtered at ingestion |
| `author` | VARCHAR(255) | |
| `published_date` | TIMESTAMP | From RSS/scrape |
| `inferred_date` | TIMESTAMP | Cross-reference estimate |
| `date_confidence` | FLOAT [0,1] | Confidence in inferred date |
| `bias_tag` | VARCHAR(20) | `left` \| `center-left` \| `center` \| `center-right` \| `right` \| `unknown` |
| `content_tags` | TEXT[] | Topic tags from classifier (e.g. `{iran,war,military}`) |
| `classified` | BOOLEAN | `false` until classifier processes |
| `is_breaking` | BOOLEAN | Breaking news flag |
| `initial_date` | TIMESTAMP | First ingestion time |
| `updated_date` | TIMESTAMP | Last update time |
| `created_at` | TIMESTAMP | Record creation |

### `sources`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `name` | VARCHAR(255) | Display name |
| `domain` | VARCHAR(255) | Unique |
| `rss_url` | TEXT | RSS/Atom feed URL |
| `scrape_selector` | TEXT | CSS selector for body content |
| `date_selector` | TEXT | CSS selector for publish date |
| `ingestion_method` | VARCHAR(20) | `rss` \| `scrape` \| `archive` \| `api` |
| `archive_fallback` | BOOLEAN | Try archive.ph if scrape fails |
| `color` | VARCHAR(20) | Per-source brand colour |
| `font` | VARCHAR(100) | Per-source brand font |
| `bias_default` | VARCHAR(20) | Known bias of the outlet |
| `category` | VARCHAR(30) | `general` \| `tech` \| `business` \| `homelab` |
| `priority` | INT [1–10] | Feed ranking weight |
| `active` | BOOLEAN | Whether to crawl |
| `crawl_interval_mins` | INT | Default 60 |
| `max_age_days` | INT | Only ingest articles younger than this |
| `last_crawl` | TIMESTAMP | |
| `next_crawl` | TIMESTAMP | |
| `crawl_status` | VARCHAR(20) | `idle` \| `running` \| `error` |
| `discovery_notes` | TEXT | Notes from auto-detection |
| `created_at` | TIMESTAMP | |

### `app_settings`

Key/value store for runtime-configurable settings. Currently used by the classifier worker.

| Column | Type | Notes |
|--------|------|-------|
| `key` | TEXT PK | Setting name |
| `value` | JSONB | Setting value |
| `updated_at` | TIMESTAMP | |

**Current keys:**

| Key | Type | Description |
|-----|------|-------------|
| `classifier_tags` | `string[]` | Topic tag vocabulary used by the classifier; editable via `/admin/classifier` |

### `crawl_jobs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `source_id` | INT FK → `sources` | |
| `status` | VARCHAR | `pending` \| `running` \| `completed` \| `failed` |
| `triggered_by` | VARCHAR | `schedule` \| `manual` \| `admin` |
| `started_at` | TIMESTAMP | |
| `completed_at` | TIMESTAMP | |
| `articles_found` | INT | Total articles discovered |
| `articles_new` | INT | New inserts |
| `articles_updated` | INT | Updates to existing |
| `error_message` | TEXT | Set on failure |

### `crawl_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `job_id` | UUID FK → `crawl_jobs` | |
| `level` | VARCHAR | `info` \| `warn` \| `error` |
| `message` | TEXT | |
| `created_at` | TIMESTAMP | |

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `email` | VARCHAR | Unique |
| `password_hash` | VARCHAR | bcrypt, cost 12 |
| `role` | VARCHAR | `admin` \| `user` |
| `created_at` | TIMESTAMP | |
| `last_login` | TIMESTAMP | |

### `sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → `users` | |
| `token` | VARCHAR | Cryptographically random; HTTP-only cookie |
| `expires_at` | TIMESTAMP | 24-hour expiry |
| `created_at` | TIMESTAMP | |

### `user_preferences`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `user_id` | UUID FK → `users` | |
| `topic` | VARCHAR(255) | Favourited topic |
| `weight` | FLOAT > 0 | Ranking boost |
| `created_at` | TIMESTAMP | |

### `article_links`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `article_id_a` | UUID FK → `articles` | |
| `article_id_b` | UUID FK → `articles` | |
| `similarity_score` | FLOAT [0,1] | |
| `link_type` | VARCHAR | `duplicate` \| `related` \| `follow_up` |
| `created_at` | TIMESTAMP | |

---

## API Routes

### Public / Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Create account (first user → admin) |
| `POST` | `/api/auth/login` | Login, sets `news_session` cookie |
| `POST` | `/api/auth/logout` | Clears session cookie |
| `GET` | `/api/auth/me` | Returns current user |

### Articles

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/articles` | Paginated article list |

Query params: `date` (YYYY-MM-DD), `page`, `limit`, `sources` (comma-sep IDs), `tags` (comma-sep strings)

### Image Proxy

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/image?url=` | Proxies external images; SSRF-safe; allows `jpeg/png/gif/webp/svg/avif` only; returns 204 for non-image responses |

### Sources (admin)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sources` | List all sources |
| `POST` | `/api/sources` | Create source |
| `GET` | `/api/sources/[id]` | Get source |
| `PATCH` | `/api/sources/[id]` | Update source |
| `DELETE` | `/api/sources/[id]` | Delete source |
| `POST` | `/api/sources/[id]/crawl` | Trigger immediate crawl |
| `POST` | `/api/sources/discover` | Auto-detect RSS for a domain |

### Crawlers (admin)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/crawlers/status` | All source statuses |
| `POST` | `/api/crawlers/crawl-all` | Trigger crawl of all active sources |

### Admin Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/settings?key=` | Read an `app_settings` value |
| `PUT` | `/api/admin/settings` | Write an `app_settings` value |
| `POST` | `/api/admin/reclassify` | Reset all `classified=false` for full re-run |

### Users (admin)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/users` | List users |
| `PATCH` | `/api/users/[id]` | Update user (role, etc.) |
| `DELETE` | `/api/users/[id]` | Delete user |

---

## How It Works

### Ingestion pipeline

1. The **scheduler** (`ingestion/src/scheduler.ts`) runs every 2 minutes and picks up to 5 sources whose `next_crawl` has passed.
2. The **crawler** (`crawler.ts`) fetches the RSS feed, deduplicates by `url_hash`, and drops articles older than `MAX_ARTICLE_AGE_DAYS`.
3. For articles with thin RSS content, **cheerio** (`scraper.ts`) scrapes the full page for body text and images.
4. If the page returns a paywall or scrape fails, **archive.ph** then the **Wayback Machine** are tried (`archive.ts`).
5. Image URLs are validated at parse time — video/stream extensions (`.m3u8`, `.mp4`, `.mov`, `.webm`, `.mpd`, etc.) are rejected so only real images reach `image_url`.
6. Articles are inserted with `classified = false`.

### Classification pipeline

1. The **classifier** (`classifier/src/index.ts`) polls every **5 seconds** for unclassified articles.
2. It fetches up to **50 articles** per batch and processes up to **5 concurrently**.
3. For each article it sends the title + up to **4,000 chars of body content** (falling back to summary, then title) to Ollama (`llama3.2`).
4. The prompt asks for a **political bias tag** and a list of matching **topic tags** from the configured vocabulary.
5. The tag vocabulary is loaded from `app_settings.classifier_tags` on every batch, falling back to a built-in default set. Changes in the admin panel take effect on the next poll — no restart needed.
6. If Ollama is unavailable, the request falls back to **Claude Haiku** via the Anthropic API.
7. `bias_tag`, `content_tags`, and `classified = true` are written back to the article row.

### Image proxy

`GET /api/image?url=<external-url>` — used by article cards to avoid exposing reader IPs to source CDNs and to work within CSP constraints.

- SSRF protection via `assertSafeUrl()` (blocks private/loopback ranges)
- Only `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `image/avif` are forwarded
- Non-image responses (including video streams) return `204 No Content`
- 5 MB response cap, 8 s timeout

### Front-page layout

The front page and day-archive pages use a three-column Bootstrap grid:

| Column | Width | Content |
|--------|-------|---------|
| Filter panel | `col-lg-2` | Source buttons + topic tag chips |
| Articles | `col-lg-7` | Lead, secondary, and brief article cards |
| Iran sidebar | `col-lg-3` | Latest Iran conflict coverage |

Filter state (active sources + tags) is persisted in URL search params (`?sources=1,2&tags=iran,war`) so selections survive day navigation.

---

## nginx Configuration

- Listens on host port **5333** → proxies to `web:3000`
- **Rate limits** (via `limit_req_zone`):
  - Auth endpoints: 5 req/min
  - API: 30 req/min
  - Image proxy: 30 req/min
- **Geo block** (`geo $limit_key`): local and Docker subnet IPs (127/8, 10/8, 172.16/12, 192.168/16) are exempt from rate limits — prevents the web container's own image proxy calls from being throttled
- Security headers in `nginx/security-headers.conf`: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`

---

## Security Notes

- **SSRF** — `assertSafeUrl()` in `ingestion/src/security.ts` blocks requests to RFC-1918/loopback ranges. The image proxy applies the same check.
- **HTML sanitisation** — article content is passed through an allowlist sanitiser before storage and again before display.
- **SQL injection** — all queries use parameterised statements (`$1`, `$2`, …); no string interpolation.
- **Auth** — bcrypt (cost 12) for passwords; random session tokens stored in `sessions` table; HTTP-only `news_session` cookie; 24-hour expiry.
- **CSP** — strict policy blocks inline scripts and unlisted external resources.
- **Network isolation** — `postgres`, `classifier`, and `ollama` have no internet route; only `ingestion` has outbound access.
- **Video URL filtering** — `feeds.ts` rejects `.m3u8/mp4/mov/webm/mpd/ts` URLs from RSS media fields so they are never stored as `image_url`.

---

## Configuration Reference

All configuration via environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `newsdb` | Database name |
| `POSTGRES_USER` | `newsuser` | Database user |
| `POSTGRES_PASSWORD` | — | **Required** |
| `SESSION_SECRET` | — | **Required.** 32+ random bytes |
| `CLAUDE_API_KEY` | — | Claude Haiku fallback for classifier |
| `OLLAMA_HOST` | `http://ollama:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `llama3.2` | Model for classification |
| `MAX_ARTICLE_AGE_DAYS` | `7` | Drop articles older than this |
| `CRAWL_TIMEOUT_MS` | `30000` | Per-request timeout |
| `CRAWL_MAX_BYTES` | `10485760` | Max response size (10 MB) |

---

## Pre-seeded Sources

| Source | Domain | Category | Bias | Priority | Interval |
|--------|--------|----------|------|----------|----------|
| BBC News | bbc.com | general | center | 8 | 60 min |
| The Guardian | theguardian.com | general | center-left | 7 | 60 min |
| RNZ | rnz.co.nz | general | center | 8 | 30 min |
| Stuff | stuff.co.nz | general | center | 7 | 60 min |
| ABC Australia | abc.net.au | general | center | 7 | 60 min |
| SMH | smh.com.au | general | center | 6 | 60 min |
| Al Jazeera | aljazeera.com | general | unknown | 6 | 60 min |
| NBC News | nbcnews.com | general | center | 5 | 60 min |
| interest.co.nz | interest.co.nz | business | center | 6 | 120 min |
| Ars Technica | arstechnica.com | tech | center | 6 | 60 min |
| The Register | theregister.com | tech | center | 6 | 60 min |
| The Verge | theverge.com | tech | center-left | 5 | 60 min |
| Wired | wired.com | tech | center-left | 4 | 120 min |
| ServeTheHome | servethehome.com | homelab | center | 3 | 240 min |
| StorageReview | storagereview.com | homelab | center | 3 | 240 min |

---

## Project Structure

```
news/
├── docker-compose.yml          # 6 services: nginx, web, postgres, ingestion, classifier, ollama
├── .env / .env.example
├── db/
│   └── init.sql                # Full schema + app_settings seed + 15 source seeds
├── nginx/
│   ├── nginx.conf              # Rate limiting (geo block), reverse proxy
│   └── security-headers.conf  # CSP, X-Frame-Options, etc.
├── ingestion/
│   └── src/
│       ├── index.ts            # DB retry loop + startup
│       ├── scheduler.ts        # Cron every 2 min, max 5 concurrent sources
│       ├── crawler.ts          # Per-source crawl orchestration
│       ├── feeds.ts            # RSS parsing; rejects video URLs from image fields
│       ├── scraper.ts          # Cheerio full-article scrape
│       ├── archive.ts          # archive.ph → Wayback Machine fallback
│       ├── discovery.ts        # Auto-detect RSS for a domain
│       ├── fetcher.ts          # SSRF-safe HTTP wrapper (timeout, size cap)
│       ├── security.ts         # assertSafeUrl(), per-domain rate limiter
│       ├── sanitize.ts         # HTML allowlist sanitiser
│       └── db.ts               # pg Pool singleton
├── classifier/
│   └── src/
│       ├── index.ts            # Polls every 5 s; batch 50; concurrency 5
│       └── bias.ts             # Ollama prompt → Claude Haiku fallback
├── web/
│   └── src/
│       ├── app/
│       │   ├── page.tsx                    # Home (today's articles)
│       │   ├── HomeClient.tsx              # Filter state; URL param sync
│       │   ├── FilterPanel.tsx             # Left panel: source + tag filters
│       │   ├── FrontPageClient.tsx         # Load-more, scroll-break, filter-aware nav
│       │   ├── day/[date]/page.tsx         # Day archive
│       │   ├── login/page.tsx
│       │   ├── admin/
│       │   │   ├── layout.tsx              # Admin auth guard
│       │   │   ├── page.tsx                # Dashboard
│       │   │   ├── classifier/             # Tag editor + Reclassify All
│       │   │   ├── sources/                # Source CRUD
│       │   │   ├── crawlers/               # Crawler status + controls
│       │   │   ├── stats/                  # Ingestion stats
│       │   │   └── users/                  # User management
│       │   ├── api/
│       │   │   ├── auth/{login,register,logout,me}/
│       │   │   ├── articles/               # GET ?date&page&limit&sources&tags
│       │   │   ├── image/                  # Image proxy (SSRF-safe)
│       │   │   ├── admin/
│       │   │   │   ├── reclassify/         # POST → reset classified=false for all
│       │   │   │   └── settings/           # GET/PUT app_settings keys
│       │   │   ├── sources/[id]/{route,crawl}/
│       │   │   ├── sources/discover/
│       │   │   ├── users/[id]/
│       │   │   └── crawlers/{status,crawl-all}/
│       │   └── components/
│       │       ├── Masthead.tsx
│       │       ├── ArticleCard.tsx         # lead / secondary / brief variants
│       │       ├── IranSidebar.tsx         # Iran conflict right sidebar (shared)
│       │       └── SourceBadge.tsx
│       └── lib/
│           ├── db.ts                       # pg Pool with hot-reload guard
│           └── auth.ts                     # Session cookie helpers
└── data/                                   # Git-ignored bind-mount volumes
    ├── postgres/
    ├── cache/
    ├── ollama/
    └── logs/
```

---

## Useful Commands

```bash
# Start all services
docker compose up -d

# Rebuild a single service after code changes
docker compose build web && docker compose up -d web

# Tail logs
docker compose logs -f ingestion
docker compose logs -f classifier

# Connect to the database
docker compose exec postgres psql -U newsuser -d newsdb

# Reset all article classifications (also available via admin UI)
curl -X POST http://localhost:5333/api/admin/reclassify \
  -H "Cookie: news_session=<token>"

# Force an immediate crawl of all sources (also available in admin UI)
curl -X POST http://localhost:5333/api/crawlers/crawl-all \
  -H "Cookie: news_session=<token>"

# Stop everything
docker compose down

# Stop and wipe the database (destructive)
docker compose down -v
```
