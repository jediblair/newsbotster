import { NextResponse }   from 'next/server';
import { requireAdmin }   from '@/lib/auth';
import { db }             from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/reclassify
 * Resets classification on all articles so the classifier worker reprocesses them.
 * Admin-only.
 */
export async function POST() {
  try {
    await requireAdmin();

    const { rowCount } = await db.query(
      `UPDATE articles
       SET classified = FALSE, bias_tag = NULL, content_tags = '{}'
       WHERE classified = TRUE`,
    );

    return NextResponse.json({ queued: rowCount ?? 0 });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: err.message === 'Unauthorized' ? 401 : 403 });
    }
    console.error('[reclassify] Error:', err);
    return NextResponse.json({ error: 'Reclassify failed' }, { status: 500 });
  }
}
