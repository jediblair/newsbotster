import { db }            from '@/lib/db';
import Masthead          from './components/Masthead';
import FrontPageClient   from './FrontPageClient';
import type { Article }  from './components/ArticleCard';

// No static prerendering — page queries live DB data
export const dynamic = 'force-dynamic';

async function fetchArticles(date: Date, page = 1, limit = 30): Promise<Article[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const offset = (page - 1) * limit;

  const { rows } = await db.query<Article>(
    `SELECT
       a.id, a.title, a.summary, a.url, a.image_url,
       a.author,
       COALESCE(a.published_date, a.inferred_date, a.created_at) AS published_date,
       a.bias_tag, a.is_breaking,
       COALESCE(a.content_tags, '{}') AS content_tags,
       s.name AS source_name, s.color AS source_color
     FROM articles a
     JOIN sources  s ON a.source_id = s.id
     WHERE s.active = TRUE
       AND COALESCE(a.published_date, a.inferred_date, a.created_at) >= $1
       AND COALESCE(a.published_date, a.inferred_date, a.created_at) <  $2
     ORDER BY a.is_breaking DESC, s.priority DESC,
              COALESCE(a.published_date, a.inferred_date, a.created_at) DESC
     LIMIT $3 OFFSET $4`,
    [start, end, limit, offset],
  );
  return rows;
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function HomePage() {
  const today    = new Date();
  const todayStr = toIsoDate(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [initial, breaking] = await Promise.all([
    fetchArticles(today, 1, 30),
    db.query<Article>(
      `SELECT a.id, a.title, a.url, s.name AS source_name, s.color AS source_color
       FROM articles a JOIN sources s ON a.source_id = s.id
       WHERE a.is_breaking = TRUE AND s.active = TRUE
         AND COALESCE(a.published_date, a.inferred_date, a.created_at) >= NOW() - INTERVAL '6 hours'
       ORDER BY COALESCE(a.published_date, a.inferred_date, a.created_at) DESC LIMIT 5`,
    ).then(r => r.rows as unknown as Article[]),
  ]);

  return (
    <main className="page-wrap">
      <Masthead date={today} />
      <FrontPageClient
        initial={initial}
        breaking={breaking}
        date={todayStr}
        prevDay={toIsoDate(yesterday)}
        nextDay={null}
      />
    </main>
  );
}
