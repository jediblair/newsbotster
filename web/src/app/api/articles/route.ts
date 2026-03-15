import { NextRequest, NextResponse } from 'next/server';
import { db }                        from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date    = searchParams.get('date');    // YYYY-MM-DD
  const page    = parseInt(searchParams.get('page')    ?? '1',  10);
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
  const offset  = (page - 1) * limit;

  // Date filter: if provided, show articles for that day; otherwise today
  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  try {
    const { rows } = await db.query(
      `SELECT
         a.id, a.title, a.summary, a.url, a.image_url,
         a.author, a.published_date, a.inferred_date,
         a.bias_tag, a.is_breaking,
         LEFT(a.content, 2000) AS content,
         s.name AS source_name, s.domain AS source_domain,
         s.color AS source_color, s.font AS source_font,
         s.priority AS source_priority, s.category AS source_category
       FROM articles a
       JOIN sources  s ON a.source_id = s.id
       WHERE s.active = TRUE
         AND COALESCE(a.published_date, a.inferred_date, a.created_at)
               >= $1
         AND COALESCE(a.published_date, a.inferred_date, a.created_at)
               < $2
       ORDER BY
         a.is_breaking DESC,
         s.priority DESC,
         COALESCE(a.published_date, a.inferred_date, a.created_at) DESC
       LIMIT $3 OFFSET $4`,
      [targetDate, nextDate, limit, offset],
    );

    return NextResponse.json({ articles: rows, page, date: targetDate.toISOString().slice(0, 10) });
  } catch (err) {
    console.error('/api/articles error:', err);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}
