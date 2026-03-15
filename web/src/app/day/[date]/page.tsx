import { notFound }                              from 'next/navigation';
import { db }                                    from '@/lib/db';
import Masthead                                   from '@/app/components/Masthead';
import HomeClient                                 from '@/app/HomeClient';
import { IranSidebar, fetchIranArticles }         from '@/app/components/IranSidebar';
import type { Article }                           from '@/app/components/ArticleCard';

export const dynamic = 'force-dynamic';

interface Props {
  params: { date: string };
}

function parseDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function fetchArticles(date: Date, page = 1, limit = 30): Promise<Article[]> {
  const start = new Date(date);
  const end   = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
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

export default async function DayPage({ params }: Props) {
  const date = parseDate(params.date);
  if (!date) notFound();

  const todayStr = toIsoDate(new Date());
  if (params.date > todayStr) notFound();

  const prev = new Date(date);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextStr = toIsoDate(next);

  const [articles, iranArticles, sourcesResult, tagsResult] = await Promise.all([
    fetchArticles(date),
    fetchIranArticles(),
    db.query<{ id: number; name: string; color: string }>(
      `SELECT id, name, color FROM sources WHERE active = TRUE ORDER BY priority DESC, name ASC`,
    ),
    db.query<{ tag: string }>(
      `SELECT t.tag, COUNT(*) AS cnt
       FROM articles
       CROSS JOIN unnest(content_tags) AS t(tag)
       WHERE COALESCE(published_date, inferred_date, created_at) >= NOW() - INTERVAL '7 days'
         AND t.tag != ''
       GROUP BY t.tag
       ORDER BY cnt DESC
       LIMIT 40`,
    ),
  ]);

  return (
    <main className="page-wrap">
      <Masthead date={date} editionLabel="Archive Edition" />
      <div className="container-fluid px-3 py-3" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <HomeClient
          initial={articles}
          breaking={[]}
          date={params.date}
          prevDay={toIsoDate(prev)}
          sources={sourcesResult.rows}
          availableTags={tagsResult.rows.map(r => r.tag)}
          sidebar={<IranSidebar articles={iranArticles} />}
          nextDay={nextStr <= todayStr ? nextStr : null}
        />
      </div>
    </main>
  );
}
