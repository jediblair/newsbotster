# News Aggregator Project

A locally-hosted news aggregator that presents articles in a classic newspaper style, with AI-powered political bias classification.

---

## Project Overview

Build a news aggregation system that:
- Ingests articles from RSS feeds and web sources
- Bypasses paywalls where possible
- Classifies articles by political leaning (left/right)
- Displays in a vintage New York Times front-page style
- Runs locally with minimal external API usage

---

## Core Features

### 1. News Ingestion
- Parse RSS feeds from configured sources
- Scrape full article content
- Bypass paywalls using archive sites (e.g., archive.org, archive.is)
- Detect and handle article updates at source

### 2. Article Database (PostgreSQL)

**Table: `articles`**
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (PK) | Unique article identifier |
| `source` | VARCHAR | Origin site (CNN, BBC, etc.) |
| `title` | TEXT | Article headline |
| `content` | TEXT | Full text |
| `url` | TEXT | Original URL |
| `url_hash` | VARCHAR | Hash for deduplication |
| `initial_date` | TIMESTAMP | First ingestion timestamp |
| `updated_date` | TIMESTAMP | Last update timestamp |
| `published_date` | TIMESTAMP | Date from article (if available) |
| `inferred_date` | TIMESTAMP | Estimated date from cross-referencing |
| `date_confidence` | FLOAT | Confidence score for inferred dates |
| `bias_tag` | VARCHAR | Political leaning classification |
| `classified` | BOOLEAN | Avoid reclassifying to save tokens |
| `created_at` | TIMESTAMP | Record creation time |

**Table: `article_links`** (Similar/Related Articles)
| Field | Type | Description |
|-------|------|-------------|
| `id` | SERIAL (PK) | Link identifier |
| `article_id_a` | UUID (FK) | First article |
| `article_id_b` | UUID (FK) | Second article |
| `similarity_score` | FLOAT | How similar (0-1) |
| `link_type` | VARCHAR | 'duplicate', 'related', 'follow_up' |
| `created_at` | TIMESTAMP | When link was detected |

**Table: `users`** (Local Authentication)
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (PK) | User identifier |
| `email` | VARCHAR | Email (unique, login) |
| `password_hash` | VARCHAR | bcrypt hashed password |
| `role` | VARCHAR | 'admin' or 'user' |
| `created_at` | TIMESTAMP | Account creation |
| `last_login` | TIMESTAMP | Last login time |

**Table: `sessions`**
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (PK) | Session identifier |
| `user_id` | UUID (FK) | User reference |
| `token` | VARCHAR | Session token |
| `expires_at` | TIMESTAMP | Expiration time |
| `created_at` | TIMESTAMP | Session creation |

**Table: `sources`**
| Field | Type | Description |
|-------|------|-------------|
| `id` | SERIAL (PK) | Source identifier |
| `name` | VARCHAR | Display name |
| `domain` | VARCHAR | Site domain |
| `rss_url` | TEXT | RSS feed URL (if available) |
| `scrape_selector` | TEXT | CSS selector for article content |
| `date_selector` | TEXT | CSS selector for publish date |
| `ingestion_method` | VARCHAR | 'rss', 'scrape', 'api', 'archive' |
| `archive_fallback` | BOOLEAN | Use archive.is if blocked |
| `color` | VARCHAR | Unique display color |
| `font` | VARCHAR | Unique display font |
| `bias_default` | VARCHAR | Known bias of source |
| `category` | VARCHAR | 'general', 'tech', 'business', 'homelab' |
| `priority` | INT | Feed ranking weight (1-10, default 5) |
| `active` | BOOLEAN | Whether to ingest |
| `crawl_interval_mins` | INT | Minutes between crawls (default 60) |
| `max_age_days` | INT | Only fetch articles this old (default 2) |
| `last_crawl` | TIMESTAMP | Last successful crawl |
| `next_crawl` | TIMESTAMP | Scheduled next crawl |
| `crawl_status` | VARCHAR | 'idle', 'running', 'error' |
| `discovery_notes` | TEXT | Notes from source discovery process |
| `created_at` | TIMESTAMP | When source was added |

**Table: `crawl_jobs`**
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (PK) | Job identifier |
| `source_id` | INT (FK) | Source being crawled |
| `status` | VARCHAR | 'pending', 'running', 'completed', 'failed' |
| `triggered_by` | VARCHAR | 'schedule', 'manual', 'admin' |
| `started_at` | TIMESTAMP | Job start time |
| `completed_at` | TIMESTAMP | Job completion time |
| `articles_found` | INT | Count of articles discovered |
| `articles_new` | INT | Count of new articles added |
| `articles_updated` | INT | Count of articles updated |
| `error_message` | TEXT | Error details if failed |

**Table: `crawl_logs`**
| Field | Type | Description |
|-------|------|-------------|
| `id` | SERIAL (PK) | Log entry identifier |
| `job_id` | UUID (FK) | Related crawl job |
| `level` | VARCHAR | 'info', 'warn', 'error' |
| `message` | TEXT | Log message |
| `created_at` | TIMESTAMP | Log timestamp |

**Table: `user_preferences`**
| Field | Type | Description |
|-------|------|-------------|
| `id` | SERIAL (PK) | Preference identifier |
| `user_id` | UUID (FK) | User reference |
| `topic` | VARCHAR | Favourited topic |
| `weight` | FLOAT | Ranking boost |

### 3. Political Bias Classification
- Use local small language model OR Claude API
- Classify as left-leaning / right-leaning / neutral
- Detect duplicate/similar articles across sources
- Cache classifications to minimize API token usage

### 4. Web Display
**Style:**
- Old-style New York Times front page aesthetic
- Modern responsive design implementation
- Unique font/color scheme per source site

**Layout:**
- AI-generated "Article of the Day" headline
- Scrollable pages of top stories
- Pagination by day (click to view previous days)
- **Deliberate break point** after initial stories to prevent doom-scrolling
- Optional "continue reading" as active user choice

### 5. User Preferences
- Favourite topics → ranked higher in feed
- Breaking news always takes priority over favourites

### 6. User Authentication
- Local accounts (email + password)
- bcrypt password hashing
- Session-based authentication
- Two roles: `admin` and `user`
- Regular users can set preferences and browse
- Admins can manage sources and trigger crawls

### 7. Admin Panel
**Source Management:**
- Add/edit/delete news sources
- Source discovery wizard (auto-detect RSS, selectors, etc.)
- Configure per-source settings:
  - Ingestion method (RSS, scrape, archive)
  - CSS selectors for content/date extraction
  - Crawl interval (default 60 minutes)
  - Max article age (default 2 days)
  - Archive fallback toggle
- View crawl status and logs per source

**Crawler Management:**
- Dashboard showing all crawler statuses
- "Crawl Now" button per source
- "Crawl All Now" for full refresh
- View active/pending/completed jobs
- Crawl history with success/error rates

### 8. Crawler System
**Scheduling:**
- Configurable per-source crawl intervals
- Cron-based scheduler in ingestion worker
- Staggered crawls to avoid overwhelming resources

**Crawl Behavior:**
- Only fetch articles from last N days (configurable, default 2)
- Skip already-ingested URLs (by url_hash)
- Detect and flag updated articles
- Respect robots.txt and rate limits

**Source Discovery Process:**
When adding a new source, the system should:
1. Check for RSS/Atom feeds (common paths, `<link>` tags)
2. Analyze homepage structure for article links
3. Sample article pages to detect content selectors
4. Test archive.is availability as fallback
5. Suggest optimal ingestion method
6. Allow manual override of detected settings

---

## Initial News Sources

### General News / Current Affairs
| Site | Region | Type | Priority |
|------|--------|------|----------|
| bbc.com | UK | General news | 8 |
| theguardian.com | UK | General news | 7 |
| rnz.co.nz | NZ | Public broadcaster | 8 |
| stuff.co.nz | NZ | General news | 7 |
| abc.net.au | AU | Public broadcaster | 7 |
| smh.com.au | AU | General news | 6 |
| aljazeera.com | Int'l | General news | 6 |
| cnn.com | US | General news | 5 |

### Business / Economics
| Site | Region | Type | Priority |
|------|--------|------|----------|
| interest.co.nz | NZ | Business/economics | 6 |

### Technology
| Site | Region | Type | Priority | Notes |
|------|--------|------|----------|-------|
| arstechnica.com | US | Tech news | 6 | In-depth analysis |
| theregister.com | UK | Tech news | 6 | Enterprise/IT focus |
| theverge.com | US | Tech/consumer | 5 | Consumer tech, reviews |
| wired.com | US | Tech/culture | 4 | Longer form |

### Homelab / Enterprise (Lower Priority)
| Site | Region | Type | Priority | Notes |
|------|--------|------|----------|-------|
| servethehome.com | US | Enterprise/homelab | 3 | Server hardware, reviews |
| storagereview.com | US | Storage/enterprise | 3 | Storage, networking |

*Homelab sources have lower priority (3) to avoid overwhelming general news. Adjust per preference.*

---

## Technical Approach

### Paywall Bypassing
- Check archive.org / archive.is for cached versions
- Use RSS full-text feeds where available
- Explore other archive/cache services

### Date Inference
When article date is unavailable:
1. Cross-reference with other sources reporting same story
2. Use `inferred_date` or `possible_date` field
3. Flag low-confidence dates for review

### Token Optimization
- Store classification results in database
- Only reclassify on significant article updates
- Batch similar articles for single classification calls

---

## Security Considerations

Since we're fetching/scraping untrusted external websites, security is critical.

### Input Sanitization
- **HTML sanitization** - Use DOMPurify or similar before storing/displaying article content
- **Strip dangerous tags** - Remove `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, event handlers
- **Sanitize URLs** - Validate and normalize all URLs before storing
- **Text-only extraction** - Prefer extracting plain text over preserving HTML where possible

### Content Security Policy (CSP)
- Strict CSP headers on all pages
- No inline scripts (`script-src 'self'`)
- Restrict image sources to self and known CDNs
- Block external fonts unless explicitly needed
- No `eval()` or `unsafe-inline`

### Crawler Security
- **Run in isolated container** - Ingestion worker has no direct access to web-facing services
- **Timeout all requests** - Max 30s per request, abort on slow/hanging sites
- **Size limits** - Cap response sizes (e.g., 10MB max) to prevent memory exhaustion
- **SSRF prevention** - Block requests to internal IPs (127.x, 10.x, 192.168.x, etc.)
- **No JavaScript execution** - Pure HTTP fetching, no headless browser unless explicitly needed
- **User-Agent honesty** - Identify as a bot, respect robots.txt
- **Rate limiting** - Max N requests per minute per domain

### Database Security
- **Parameterized queries only** - Never interpolate user input into SQL
- **Use an ORM** - Prisma or Drizzle with TypeScript for type-safe queries
- **Principle of least privilege** - Separate DB users for web app vs workers
- **Escape stored content** - Double-escape when displaying user-controlled data

### Authentication & Sessions
- **bcrypt for passwords** - Cost factor 12+
- **Secure session tokens** - Cryptographically random, HTTP-only cookies
- **CSRF protection** - SameSite cookies, CSRF tokens on forms
- **Rate limit auth endpoints** - Prevent brute force (e.g., 5 attempts per minute)
- **Session expiry** - Auto-expire after inactivity (e.g., 24 hours)

### Network Isolation (Docker)
```yaml
networks:
  frontend:      # nginx, web
  backend:       # web, postgres, workers
  external:      # ingestion worker only (outbound internet)
```
- Web app cannot directly access the internet
- Only ingestion worker has outbound access
- Database only accessible from internal network

### Logging & Monitoring
- Log all crawl attempts with source URL
- Alert on repeated failures to same domain
- Monitor for unusual patterns (excessive redirects, large responses)
- Never log passwords or session tokens

### Content Display
- **Render article content as text/safe HTML only**
- **No auto-playing media**
- **Lazy-load images through a proxy** - Don't expose user IPs to source sites
- **Consider image caching** - Store images locally rather than hotlinking

---

## Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Database** | PostgreSQL | Robust relational DB, good for linking tables & full-text search |
| **Web App** | Next.js 14 | SSR for newspaper layouts, built-in API routes, React ecosystem |
| **Workers** | Node.js + TypeScript | Background ingestion & classification jobs |
| **Web Server** | nginx | Reverse proxy, static file serving, caching |
| **Containerization** | Docker Compose | Local deployment, easy orchestration |
| **LLM** | Ollama (local) / Claude API | Bias classification, article summarization |

### Why Next.js?
- **Server-side rendering** - Perfect for newspaper-style layouts that should feel "printed"
- **API routes** - Built-in backend endpoints, no separate server needed
- **App Router** - Modern routing with layouts for consistent newspaper structure
- **Image optimization** - Built-in for article thumbnails
- **CSS Modules / Tailwind** - Easy to create unique per-source styling

### Docker Containers

```yaml
services:
  postgres:      # PostgreSQL database
  ingestion:     # RSS/scraper worker (Node.js)
  classifier:    # LLM classification worker
  web:           # Next.js application
  nginx:         # Reverse proxy & static serving
  ollama:        # Local LLM (optional)

networks:
  frontend:      # Public-facing: nginx, web
  backend:       # Internal: web, postgres, workers, ollama
  external:      # Outbound internet: ingestion only
```

**Network Security:**
- `postgres` - backend only (no internet, no public access)
- `web` - frontend + backend (talks to DB, serves via nginx)
- `nginx` - frontend only (public-facing)
- `ingestion` - backend + external (fetches from internet, writes to DB)
- `classifier` - backend only (reads DB, talks to ollama)
- `ollama` - backend only (no internet access)

### Persistent Volumes

All data and source code stored outside containers for persistence and easy development:

```yaml
volumes:
  # Database
  postgres_data:           # PostgreSQL data files
  
  # Application data
  article_cache:           # Cached article content & images
  ollama_models:           # Downloaded LLM models
  
  # Logs
  logs:                    # Application logs across services
```

**Bind Mounts (Source Code):**
| Host Path | Container Path | Service | Purpose |
|-----------|---------------|---------|---------|
| `./web` | `/app` | web | Next.js source (hot reload in dev) |
| `./ingestion` | `/app` | ingestion | Ingestion worker source |
| `./classifier` | `/app` | classifier | Classifier worker source |
| `./nginx/nginx.conf` | `/etc/nginx/nginx.conf` | nginx | nginx configuration |
| `./db/init.sql` | `/docker-entrypoint-initdb.d/` | postgres | Initial schema |

**Named Volumes (Persistent Data):**
| Volume | Container Path | Service | Purpose |
|--------|---------------|---------|---------|
| `postgres_data` | `/var/lib/postgresql/data` | postgres | Database files |
| `article_cache` | `/data/cache` | ingestion, web | Cached content |
| `ollama_models` | `/root/.ollama` | ollama | LLM model weights |
| `logs` | `/var/log/app` | all | Centralized logs |

### System Diagram

```
                            ┌─────────────────────────────────────────────┐
                            │              Docker Network                  │
                            │                                              │
┌──────────┐               │  ┌──────────┐      ┌──────────────────────┐ │
│  User    │◀──────────────┼──│  nginx   │◀─────│  Next.js (web)       │ │
│ Browser  │   :80/:443    │  │  :80     │      │  :3000               │ │
└──────────┘               │  └──────────┘      └──────────────────────┘ │
                           │                              │               │
                           │                              ▼               │
                           │  ┌──────────────────────────────────────┐   │
                           │  │           PostgreSQL :5432           │   │
                           │  └──────────────────────────────────────┘   │
                           │        ▲                    ▲               │
                           │        │                    │               │
                           │  ┌─────┴──────┐      ┌──────┴─────┐        │
                           │  │ Ingestion  │      │ Classifier │        │
                           │  │  Worker    │      │   Worker   │        │
                           │  └────────────┘      └────────────┘        │
                           │        │                    │               │
                           │        ▼                    ▼               │
                           │  ┌────────────┐      ┌────────────┐        │
                           │  │  Archive   │      │   Ollama   │        │
                           │  │  Services  │      │  (local)   │        │
                           │  └────────────┘      └────────────┘        │
                           │                             or              │
                           │                      ┌────────────┐        │
                           │                      │ Claude API │        │
                           │                      └────────────┘        │
                           └─────────────────────────────────────────────┘
```

---

## Project Structure (Proposed)

```
news/
├── docker-compose.yml
├── .env.example
├── PROJECT.md
│
├── web/                      # Next.js frontend
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── app/                  # App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx          # Front page
│   │   ├── day/[date]/
│   │   ├── login/
│   │   ├── register/
│   │   ├── admin/
│   │   │   ├── page.tsx      # Admin dashboard
│   │   │   ├── sources/
│   │   │   │   ├── page.tsx  # Source list
│   │   │   │   ├── new/      # Add source wizard
│   │   │   │   └── [id]/     # Edit source
│   │   │   ├── crawlers/
│   │   │   │   └── page.tsx  # Crawler status
│   │   │   └── users/
│   │   │       └── page.tsx  # User management
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/
│   │       │   ├── logout/
│   │       │   └── register/
│   │       ├── sources/
│   │       │   ├── discover/  # Source discovery
│   │       │   └── [id]/
│   │       │       └── crawl/ # Trigger crawl
│   │       └── crawlers/
│   │           └── status/
│   ├── components/
│   │   ├── Headline.tsx
│   │   ├── ArticleCard.tsx
│   │   ├── SourceBadge.tsx
│   │   └── admin/
│   │       ├── SourceForm.tsx
│   │       ├── CrawlerCard.tsx
│   │       └── DiscoveryWizard.tsx
│   ├── lib/
│   │   ├── auth.ts           # Session handling
│   │   ├── db.ts             # Database client
│   │   ├── sanitize.ts       # HTML sanitization (DOMPurify)
│   │   └── csrf.ts           # CSRF token handling
│   ├── middleware.ts         # Auth & security middleware
│   └── styles/
│       └── newspaper.css
│
├── ingestion/                # RSS/scraper worker
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.ts          # Main scheduler
│       ├── scheduler.ts      # Cron-based job scheduling
│       ├── crawler.ts        # Crawl execution
│       ├── feeds.ts          # RSS parsing
│       ├── scraper.ts        # Web scraping
│       ├── archive.ts        # Archive fallback
│       ├── discovery.ts      # Source auto-detection
│       ├── sanitize.ts       # Content sanitization
│       └── security.ts       # SSRF protection, rate limiting
│
├── classifier/               # LLM classification
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── bias.ts
│       ├── similarity.ts
│       └── summarize.ts
│
├── db/                       # Database
│   ├── init.sql
│   └── migrations/
│
├── nginx/
│   ├── nginx.conf
│   └── security-headers.conf # CSP, X-Frame-Options, etc.
│
└── data/                     # Persistent volumes (gitignored)
    ├── postgres/             # PostgreSQL data files
    ├── cache/                # Article cache & images
    ├── ollama/               # LLM model weights
    └── logs/                 # Application logs
```

---

## Next Steps

1. **Project Setup**
   - Initialize Docker Compose configuration with volumes and networks
   - Create `data/` directory structure (gitignored)
   - Set up PostgreSQL container with persistent volume
   - Create database schema and migrations
   - Configure network isolation (frontend/backend/external)

2. **Security Foundation**
   - Set up CSP headers in nginx/Next.js
   - Implement HTML sanitization (DOMPurify)
   - Configure request timeouts and size limits
   - Add SSRF protection (block internal IPs)
   - Set up rate limiting

3. **Authentication System**
   - Implement local user registration/login
   - Session management with secure tokens (HTTP-only cookies)
   - Role-based access (admin/user)
   - Protected API routes
   - CSRF protection

4. **Admin Panel**
   - Source management CRUD
   - Source discovery wizard
   - Crawler status dashboard
   - User management (admin only)

5. **Crawler System**
   - Cron-based scheduler
   - Per-source crawl intervals
   - "Crawl Now" API endpoint
   - Job queue and status tracking
   - Crawl logs and error handling

6. **Next.js Web App**
   - Initialize Next.js 14 with App Router
   - Create newspaper-style layout components
   - Set up per-source fonts/colors
   - Build API routes for articles
   - Image proxy for cached content

7. **Ingestion Worker**
   - Source discovery/auto-detection
   - RSS feed parser
   - Web scraper with archive fallback
   - Article deduplication logic
   - Max age filtering (default 2 days)
   - Content sanitization before storage

8. **Classification Worker**
   - Ollama integration for local LLM
   - Claude API fallback
   - Similarity detection & article linking

9. **nginx Configuration**
   - Reverse proxy setup
   - Static asset caching
   - SSL termination (optional)
   - Security headers

10. **User Features**
    - Preference storage
    - Topic favouriting
    - Breaking news detection

---

*Project initialized: March 2026*
