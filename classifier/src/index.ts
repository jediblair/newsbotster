import { Pool }                      from 'pg';
import { classifyArticle, DEFAULT_TAGS } from './bias';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

const BATCH_SIZE     = 50;
const CONCURRENCY    = 5;      // parallel Ollama requests per batch
const INTERVAL_MS    = 5_000;  // run every 5 seconds

/** Load classifier tags from app_settings, falling back to built-in defaults. */
async function loadClassifierTags(): Promise<string[]> {
  try {
    const { rows } = await db.query<{ value: string[] }>(
      `SELECT value FROM app_settings WHERE key = 'classifier_tags'`,
    );
    if (rows.length > 0 && Array.isArray(rows[0].value) && rows[0].value.length > 0) {
      return rows[0].value as string[];
    }
  } catch (err) {
    console.warn('[classifier] Could not load tags from DB, using defaults:', (err as Error).message);
  }
  return DEFAULT_TAGS;
}

/**
 * Find unclassified articles and classify them in small batches.
 */
async function classifyBatch(): Promise<void> {
  const validTags = await loadClassifierTags();

  const { rows } = await db.query<{
    id: string; title: string; summary: string | null; content: string | null;
  }>(
    `SELECT id, title, summary, content FROM articles
     WHERE classified = FALSE
       AND (summary IS NOT NULL OR title IS NOT NULL)
     LIMIT $1`,
    [BATCH_SIZE],
  );

  if (rows.length === 0) return;
  console.log(`[classifier] Classifying ${rows.length} articles (concurrency ${CONCURRENCY}, tags: ${validTags.length})...`);

  // Process in parallel with a concurrency cap
  const queue = [...rows];
  async function worker() {
    while (queue.length > 0) {
      const article = queue.shift()!;
      try {
        const bodyText = (article.content && article.content.length > (article.summary?.length ?? 0))
          ? article.content.slice(0, 4000)
          : (article.summary ?? article.title);

        const { bias, tags } = await classifyArticle(article.title, bodyText, validTags);

        await db.query(
          `UPDATE articles SET bias_tag = $2, classified = TRUE, content_tags = $3 WHERE id = $1`,
          [article.id, bias, tags],
        );
      } catch (err) {
        console.error(`[classifier] Failed on article ${article.id}:`, err);
        await db.query(
          `UPDATE articles SET bias_tag = 'unknown', classified = TRUE WHERE id = $1`,
          [article.id],
        );
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
}

async function main(): Promise<void> {
  console.log('[classifier] Starting classification worker...');

  // Wait for DB
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await db.query('SELECT 1');
      console.log('[classifier] Database connected');
      break;
    } catch {
      console.warn(`[classifier] DB not ready (${attempt}/10), retrying...`);
      await new Promise(r => setTimeout(r, 3000));
      if (attempt === 10) { console.error('[classifier] Cannot connect to DB'); process.exit(1); }
    }
  }

  // Run on interval
  const run = async () => {
    try { await classifyBatch(); } catch (err) { console.error('[classifier] Batch error:', err); }
    setTimeout(run, INTERVAL_MS);
  };

  setTimeout(run, 10_000); // initial delay to let ingestion populate some articles
}

main().catch(err => { console.error('[classifier] Fatal:', err); process.exit(1); });
