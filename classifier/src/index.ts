import { Pool }           from 'pg';
import { classifyArticle } from './bias';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

const BATCH_SIZE     = 10;
const INTERVAL_MS    = 30_000; // run every 30 seconds

/**
 * Find unclassified articles and classify them in small batches.
 */
async function classifyBatch(): Promise<void> {
  const { rows } = await db.query<{
    id: string; title: string; summary: string | null;
  }>(
    `SELECT id, title, summary FROM articles
     WHERE classified = FALSE
       AND (summary IS NOT NULL OR title IS NOT NULL)
     LIMIT $1`,
    [BATCH_SIZE],
  );

  if (rows.length === 0) return;
  console.log(`[classifier] Classifying ${rows.length} articles...`);

  for (const article of rows) {
    try {
      const { bias, tags } = await classifyArticle(
        article.title,
        article.summary ?? article.title,
      );

      await db.query(
        `UPDATE articles SET bias_tag = $2, classified = TRUE, content_tags = $3 WHERE id = $1`,
        [article.id, bias, tags],
      );
    } catch (err) {
      console.error(`[classifier] Failed on article ${article.id}:`, err);
      // Mark as classified anyway to avoid retry loops
      await db.query(
        `UPDATE articles SET bias_tag = 'unknown', classified = TRUE WHERE id = $1`,
        [article.id],
      );
    }
  }
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
