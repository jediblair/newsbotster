import { NextRequest, NextResponse } from 'next/server';
import { db }                        from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date   = searchParams.get('date');
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  // Optional source/tag filters
  const sourceParam = searchParams.get('sources') ?? '';
  const tagParam    = searchParams.get('tags')    ?? '';
  const sourceIds   = sourceParam
    ? sourceParam.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0)
    : [];
  const filterTags  = tagParam
    ? tagParam.split(',').filter(t => /^[a-z0-9-]{1,30}$/.test(t))
    : [];

  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  // Build optional WHERE conditions dynamically
  const extraWhere: string[] = [];
  const extraParams: unknown[] = [];
  let p = 5; // $1–$4 are fixed

  if (sourceIds.length > 0) {
    extraWhere.push(`a.source_id = ANY($${p}::int[])`);
    extraParams.push(sourceIds);
    p++;
  }
  if (filterTags.length > 0) {
    extraWhere.push(`a.content_tags && $${p}::text[]`);
    extraParams.push(filterTags);
    p++;
  }
  const extraSQL = extraWhere.length > 0 ? `AND ${extraWhere.join(' AND ')}` : '';

  try {
    const { rows } = await db.query(
      `SELECT
         a.id, a.title, a.summary, a.url, a.image_url,
         a.author, a.published_date, a.inferred_date,
         a.bias_tag, a.is_breaking,
         COALESCE(a.content_tags, '{}') AS content_tags,
         s.name AS source_name, s.domain AS source_domain,
         s.color AS source_color, s.font AS source_font,
         s.priority AS source_priority, s.category AS source_category
       FROM articles a
       JOIN sources s ON a.source_id = s.id
       WHERE s.active = TRUE
         AND COALESCE(a.published_date, a.inferred_date, a.created_at) >= $1
         AND COALESCE(a.published_date, a.inferred_date, a.created_at) <  $2
         ${extraSQL}
       ORDER BY
         a.is_breaking DESC,
         s.priority DESC,
         COALESCE(a.published_date, a.inferred_date, a.created_at) DESC
       LIMIT $3 OFFSET $4`,
      [targetDate, nextDate, limit, offset, ...extraParams],
    );

    return NextResponse.json({ articles: rows, page, date: targetDate.toISOString().slice(0, 10) });
  } catch (err) {
    console.error('/api/articles error:', err);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}
