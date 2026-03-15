-- ============================================================
--  News Aggregator Database Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  last_login    TIMESTAMP
);

-- ─── Sessions ────────────────────────────────────────────────
CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP   NOT NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- ─── Sources ─────────────────────────────────────────────────
CREATE TABLE sources (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(255) NOT NULL,
  domain              VARCHAR(255) NOT NULL UNIQUE,
  rss_url             TEXT,
  scrape_selector     TEXT,
  date_selector       TEXT,
  ingestion_method    VARCHAR(20)  NOT NULL DEFAULT 'rss'
                        CHECK (ingestion_method IN ('rss','scrape','archive','api')),
  archive_fallback    BOOLEAN      NOT NULL DEFAULT FALSE,
  color               VARCHAR(20)  NOT NULL DEFAULT '#333333',
  font                VARCHAR(100) NOT NULL DEFAULT 'serif',
  bias_default        VARCHAR(20)  CHECK (bias_default IN ('far-left','left','center-left','center','center-right','right','far-right','unknown')),
  category            VARCHAR(30)  NOT NULL DEFAULT 'general'
                        CHECK (category IN ('general','tech','business','homelab')),
  priority            INT          NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  active              BOOLEAN      NOT NULL DEFAULT TRUE,
  crawl_interval_mins INT          NOT NULL DEFAULT 60,
  max_age_days        INT          NOT NULL DEFAULT 2,
  last_crawl          TIMESTAMP,
  next_crawl          TIMESTAMP,
  crawl_status        VARCHAR(20)  NOT NULL DEFAULT 'idle'
                        CHECK (crawl_status IN ('idle','running','error')),
  discovery_notes     TEXT,
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── Articles ────────────────────────────────────────────────
CREATE TABLE articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        INT          NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL,
  summary          TEXT,
  content          TEXT,
  url              TEXT         NOT NULL UNIQUE,
  url_hash         VARCHAR(64)  NOT NULL UNIQUE,
  image_url        TEXT,
  author           VARCHAR(255),
  published_date   TIMESTAMP,
  inferred_date    TIMESTAMP,
  date_confidence  FLOAT        CHECK (date_confidence BETWEEN 0 AND 1),
  bias_tag         VARCHAR(20)  CHECK (bias_tag IN ('left','center-left','center','center-right','right','unknown')),
  content_tags     TEXT[]       NOT NULL DEFAULT '{}',
  classified       BOOLEAN      NOT NULL DEFAULT FALSE,
  is_breaking      BOOLEAN      NOT NULL DEFAULT FALSE,
  initial_date     TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_date     TIMESTAMP    NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_articles_source_id    ON articles(source_id);
CREATE INDEX idx_articles_published    ON articles(published_date DESC NULLS LAST);
CREATE INDEX idx_articles_url_hash     ON articles(url_hash);
CREATE INDEX idx_articles_classified   ON articles(classified);
CREATE INDEX idx_articles_is_breaking  ON articles(is_breaking);

-- ─── Article Links (Similar / Related) ───────────────────────
CREATE TABLE article_links (
  id               SERIAL PRIMARY KEY,
  article_id_a     UUID        NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  article_id_b     UUID        NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  similarity_score FLOAT       NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  link_type        VARCHAR(20) NOT NULL DEFAULT 'related'
                     CHECK (link_type IN ('duplicate','related','follow_up')),
  created_at       TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE(article_id_a, article_id_b),
  CHECK (article_id_a <> article_id_b)
);
CREATE INDEX idx_article_links_a ON article_links(article_id_a);
CREATE INDEX idx_article_links_b ON article_links(article_id_b);

-- ─── Crawl Jobs ──────────────────────────────────────────────
CREATE TABLE crawl_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id        INT         NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','running','completed','failed')),
  triggered_by     VARCHAR(20) NOT NULL DEFAULT 'schedule'
                     CHECK (triggered_by IN ('schedule','manual','admin')),
  started_at       TIMESTAMP,
  completed_at     TIMESTAMP,
  articles_found   INT         DEFAULT 0,
  articles_new     INT         DEFAULT 0,
  articles_updated INT         DEFAULT 0,
  error_message    TEXT,
  created_at       TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_crawl_jobs_source_id ON crawl_jobs(source_id);
CREATE INDEX idx_crawl_jobs_status    ON crawl_jobs(status);
CREATE INDEX idx_crawl_jobs_created   ON crawl_jobs(created_at DESC);

-- ─── Crawl Logs ──────────────────────────────────────────────
CREATE TABLE crawl_logs (
  id         SERIAL PRIMARY KEY,
  job_id     UUID        NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  level      VARCHAR(10) NOT NULL DEFAULT 'info'
               CHECK (level IN ('info','warn','error')),
  message    TEXT        NOT NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_crawl_logs_job_id ON crawl_logs(job_id);

-- ─── User Preferences ────────────────────────────────────────
CREATE TABLE user_preferences (
  id         SERIAL PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic      VARCHAR(255) NOT NULL,
  weight     FLOAT        NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, topic)
);
CREATE INDEX idx_user_prefs_user_id ON user_preferences(user_id);

-- ─── Seed: Default News Sources ──────────────────────────────
INSERT INTO sources (name, domain, rss_url, ingestion_method, color, font, bias_default, category, priority, crawl_interval_mins) VALUES
  ('BBC News',         'bbc.com',            'https://feeds.bbci.co.uk/news/rss.xml',           'rss',    '#c8102e', 'Georgia, serif',          'center',       'general', 8, 60),
  ('The Guardian',     'theguardian.com',    'https://www.theguardian.com/world/rss',            'rss',    '#052962', 'Guardian Text Egyptian',  'center-left',  'general', 7, 60),
  ('RNZ',              'rnz.co.nz',          'https://www.rnz.co.nz/rss/news.rss',              'rss',    '#000000', 'Helvetica Neue, sans',    'center',       'general', 8, 30),
  ('Stuff',            'stuff.co.nz',        'https://www.stuff.co.nz/rss',                     'rss',    '#e8202a', 'Arial, sans-serif',       'center',       'general', 7, 60),
  ('ABC Australia',    'abc.net.au',         'https://www.abc.net.au/news/feed/51120/rss.xml',   'rss',    '#00539b', 'ABC Sans, sans-serif',    'center',       'general', 7, 60),
  ('SMH',              'smh.com.au',         'https://www.smh.com.au/rss/feed.xml',              'rss',    '#003057', 'Times New Roman, serif',  'center',       'general', 6, 60),
  ('Al Jazeera',       'aljazeera.com',      'https://www.aljazeera.com/xml/rss/all.xml',        'rss',    '#c8a427', 'Arial, sans-serif',       'unknown',      'general', 6, 60),
  ('CNN',              'cnn.com',            'http://rss.cnn.com/rss/edition.rss',               'rss',    '#cc0000', 'CNN Sans, sans-serif',    'center-left',  'general', 5, 60),
  ('interest.co.nz',   'interest.co.nz',     'https://www.interest.co.nz/rss',                  'rss',    '#2d6a3f', 'Arial, sans-serif',       'center',       'business',6, 120),
  ('Ars Technica',     'arstechnica.com',    'https://feeds.arstechnica.com/arstechnica/index', 'rss',    '#ef4624', 'Gentona, sans-serif',     'center',       'tech',    6, 60),
  ('The Register',     'theregister.com',    'https://www.theregister.com/headlines.atom',       'rss',    '#c00',    'Trebuchet MS, sans-serif','center',       'tech',    6, 60),
  ('The Verge',        'theverge.com',       'https://www.theverge.com/rss/index.xml',           'rss',    '#fa4b2a', 'Polysans, sans-serif',    'center-left',  'tech',    5, 60),
  ('Wired',            'wired.com',          'https://www.wired.com/feed/rss',                   'rss',    '#000000', 'Knockout, sans-serif',    'center-left',  'tech',    4, 120),
  ('ServeTheHome',     'servethehome.com',   'https://www.servethehome.com/feed/',               'rss',    '#0a6640', 'Arial, sans-serif',       'center',       'homelab', 3, 240),
  ('StorageReview',    'storagereview.com',  'https://www.storagereview.com/feed',               'rss',    '#004b8d', 'Arial, sans-serif',       'center',       'homelab', 3, 240);
