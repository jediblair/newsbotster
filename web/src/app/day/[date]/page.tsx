import { notFound }      from 'next/navigation';
import { db }            from '@/lib/db';
import Masthead          from '@/app/components/Masthead';
import FrontPageClient   from '@/app/FrontPageClient';
import type { Article }  from '@/app/components/ArticleCard';

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

  // Reject future dates
  const todayStr = toIsoDate(new Date());
  if (params.date > todayStr) notFound();

  const articles = await fetchArticles(date);

  const prev = new Date(date);
  prev.setUTCDate(prev.getUTCDate() - 1);

  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextStr = toIsoDate(next);

  return (
    <main className="page-wrap">
      <Masthead date={date} editionLabel="Archive Edition" />
      <FrontPageClient
        initial={articles}
        breaking={[]}
        date={params.date}
        prevDay={toIsoDate(prev)}
        nextDay={nextStr <= todayStr ? nextStr : null}
      />
    </main>
  );
}
