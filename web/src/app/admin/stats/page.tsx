export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';

/** Safely format any DB-returned date value as a locale string */
function fmtDate(val: unknown): string {
  if (val == null) return '—';
  try {
    const d = val instanceof Date ? val : new Date(String(val));
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
  } catch {
    return String(val);
  }
}

interface OverviewRow {
  total_articles: string;
  with_content:   string;
  with_images:    string;
  classified:     string;
  total_sources:  string;
  total_users:    string;
  total_sessions: string;
}

interface SourceRow {
  id:            string;
  name:          string;
  category:      string;
  article_count: string;
  classified:    string;
  with_content:  string;
  with_images:   string;
  latest:        string | null;
}

interface DayRow {
  day:   string;
  count: string;
}

interface BiasRow {
  bias_tag: string | null;
  count:    string;
}

interface CrawlErrorRow {
  source_name: string;
  level:       string;
  message:     string;
  created_at:  string;
}

interface CrawlSummaryRow {
  source_name: string;
  total:       string;
  success:     string;
  errors:      string;
  avg_new:     string;
  last_run:    string | null;
}

interface ClassificationRow {
  id:         string;
  title:      string;
  bias_tag:   string | null;
  classified: boolean;
  source_name: string;
  classified_at: string | null;
}

interface ClassifierStatsRow {
  total:          string;
  classified:     string;
  unclassified:   string;
  unknown_count:  string;
}

export default async function StatsPage() {
  const [
    { rows: [overview] },
    { rows: sourceRows },
    { rows: dayRows },
    { rows: biasRows },
    { rows: crawlErrors },
    { rows: crawlSummary },
    { rows: recentClassified },
    { rows: [classifierStats] },
  ] = await Promise.all([
    db.query<OverviewRow>(`
      SELECT
        (SELECT COUNT(*)::text FROM articles)                                           AS total_articles,
        (SELECT COUNT(*)::text FROM articles WHERE content IS NOT NULL)                 AS with_content,
        (SELECT COUNT(*)::text FROM articles WHERE image_url IS NOT NULL)               AS with_images,
        (SELECT COUNT(*)::text FROM articles WHERE classified = TRUE)                   AS classified,
        (SELECT COUNT(*)::text FROM sources  WHERE active = TRUE)                       AS total_sources,
        (SELECT COUNT(*)::text FROM users)                                              AS total_users,
        (SELECT COUNT(*)::text FROM sessions WHERE expires_at > NOW())                  AS total_sessions
    `),
    db.query<SourceRow>(`
      SELECT
        s.id::text,
        s.name,
        COALESCE(s.category, 'general') AS category,
        COUNT(a.id)::text                                                              AS article_count,
        SUM(CASE WHEN a.classified = TRUE  THEN 1 ELSE 0 END)::text                   AS classified,
        SUM(CASE WHEN a.content IS NOT NULL THEN 1 ELSE 0 END)::text                  AS with_content,
        SUM(CASE WHEN a.image_url IS NOT NULL THEN 1 ELSE 0 END)::text                AS with_images,
        MAX(COALESCE(a.published_date, a.inferred_date, a.created_at))::text          AS latest
      FROM sources s
      LEFT JOIN articles a ON a.source_id = s.id
      WHERE s.active = TRUE
      GROUP BY s.id
      ORDER BY COUNT(a.id) DESC
    `),
    db.query<DayRow>(`
      SELECT
        DATE(COALESCE(published_date, inferred_date, created_at))::text AS day,
        COUNT(*)::text AS count
      FROM articles
      WHERE COALESCE(published_date, inferred_date, created_at) >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `),
    db.query<BiasRow>(`
      SELECT
        COALESCE(bias_tag, 'unclassified') AS bias_tag,
        COUNT(*)::text AS count
      FROM articles
      GROUP BY bias_tag
      ORDER BY COUNT(*) DESC
    `),
    db.query<CrawlErrorRow>(`
      SELECT
        s.name AS source_name,
        cl.level,
        LEFT(cl.message, 120) AS message,
        cl.created_at::text
      FROM crawl_logs cl
      JOIN crawl_jobs cj ON cl.job_id = cj.id
      JOIN sources s ON cj.source_id = s.id
      WHERE cl.level IN ('error', 'warn')
      ORDER BY cl.created_at DESC
      LIMIT 20
    `),
    db.query<CrawlSummaryRow>(`
      SELECT
        s.name AS source_name,
        COUNT(j.id)::text                                           AS total,
        SUM(CASE WHEN j.status = 'completed' THEN 1 ELSE 0 END)::text  AS success,
        SUM(CASE WHEN j.status = 'failed' THEN 1 ELSE 0 END)::text AS errors,
        ROUND(AVG(j.articles_new))::text                            AS avg_new,
        MAX(j.completed_at)::text                                   AS last_run
      FROM crawl_jobs j
      JOIN sources s ON j.source_id = s.id
      GROUP BY s.id
      ORDER BY MAX(j.created_at) DESC
    `),
    db.query<ClassificationRow>(`
      SELECT
        a.id::text, LEFT(a.title, 80) AS title,
        a.bias_tag, a.classified,
        s.name AS source_name,
        a.created_at::text AS classified_at
      FROM articles a
      JOIN sources s ON a.source_id = s.id
      WHERE a.classified = TRUE
      ORDER BY a.created_at DESC
      LIMIT 30
    `),
    db.query<ClassifierStatsRow>(`
      SELECT
        COUNT(*)::text AS total,
        SUM(CASE WHEN classified THEN 1 ELSE 0 END)::text AS classified,
        SUM(CASE WHEN NOT classified THEN 1 ELSE 0 END)::text AS unclassified,
        SUM(CASE WHEN bias_tag = 'unknown' AND classified THEN 1 ELSE 0 END)::text AS unknown_count
      FROM articles
    `),
  ]);

  const BIAS_COLOURS: Record<string, string> = {
    'far-left':     '#1e3a8a',
    'left':         '#2563eb',
    'center-left':  '#60a5fa',
    'center':       '#6b7280',
    'center-right': '#fb923c',
    'right':        '#dc2626',
    'far-right':    '#7f1d1d',
    'unclassified': '#d1d5db',
  };

  const maxDayCount = dayRows.length > 0 ? Math.max(...dayRows.map(r => parseInt(r.count) || 0)) : 0;

  return (
    <div className="space-y-10">
      <h1 className="headline text-3xl font-bold">Database Statistics</h1>

      {/* ─── Overview ─────────────────────────────────────────── */}
      <section>
        <h2 className="headline text-xl font-bold mb-4 pb-1 border-b border-gray-300">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Articles',    value: overview.total_articles },
            { label: 'With Content',      value: overview.with_content },
            { label: 'With Images',       value: overview.with_images },
            { label: 'Classified',        value: overview.classified },
            { label: 'Active Sources',    value: overview.total_sources },
            { label: 'Users',             value: overview.total_users },
            { label: 'Active Sessions',   value: overview.total_sessions },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded p-4">
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Articles per day (last 30) ───────────────────────── */}
      <section>
        <h2 className="headline text-xl font-bold mb-4 pb-1 border-b border-gray-300">Articles per Day (last 30 days)</h2>
        <div className="bg-white border border-gray-200 rounded p-4 overflow-auto">
          <div className="flex items-end gap-1 h-24">
            {[...dayRows].reverse().map(r => {
              const pct = maxDayCount > 0 ? (parseInt(r.count) / maxDayCount) * 100 : 0;
              return (
                <div key={r.day} className="flex flex-col items-center flex-1 min-w-[18px]" title={`${r.day}: ${r.count}`}>
                  <div
                    className="w-full bg-gray-700 rounded-t"
                    style={{ height: `${pct}%`, minHeight: pct > 0 ? '2px' : '0' }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{dayRows.length > 0 ? String([...dayRows].reverse()[0].day) : ''}</span>
            <span>{dayRows.length > 0 ? String(dayRows[0].day) : ''}</span>
          </div>
        </div>
      </section>

      {/* ─── Articles per source ──────────────────────────────── */}
      <section>
        <h2 className="headline text-xl font-bold mb-4 pb-1 border-b border-gray-300">Articles by Source</h2>
        <div className="bg-white border border-gray-200 overflow-auto rounded">
          <table className="w-full admin-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Category</th>
                <th className="text-right">Articles</th>
                <th className="text-right">Classified</th>
                <th className="text-right">w/ Content</th>
                <th className="text-right">w/ Images</th>
                <th>Latest Article</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.map(r => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}</td>
                  <td className="text-gray-500">{r.category}</td>
                  <td className="text-right font-mono">{r.article_count}</td>
                  <td className="text-right font-mono text-gray-500">{r.classified}</td>
                  <td className="text-right font-mono text-gray-500">{r.with_content}</td>
                  <td className="text-right font-mono text-gray-500">{r.with_images}</td>
                  <td className="text-xs text-gray-400">
                    {fmtDate(r.latest)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Bias distribution ────────────────────────────────── */}
      <section>
        <h2 className="headline text-xl font-bold mb-4 pb-1 border-b border-gray-300">Bias Classification</h2>
        <div className="bg-white border border-gray-200 rounded p-4">
          <div className="space-y-2">
            {biasRows.map(r => {
              const total = biasRows.reduce((s, x) => s + parseInt(x.count), 0);
              const pct   = total > 0 ? Math.round((parseInt(r.count) / total) * 100) : 0;
              const color = BIAS_COLOURS[r.bias_tag ?? 'unclassified'] ?? '#6b7280';
              return (
                <div key={r.bias_tag} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-gray-600 capitalize">{r.bias_tag}</span>
                  <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <span className="w-16 text-sm text-right text-gray-500">{r.count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Crawl summary per source ─────────────────────────── */}
      <section>
        <h2 className="headline text-xl font-bold mb-4 pb-1 border-b border-gray-300">Crawl History by Source</h2>
        <div className="bg-white border border-gray-200 overflow-auto rounded">
          <table className="w-full admin-table">
            <thead>
              <tr>
                <th>Source</th>
                <th className="text-right">Total Runs</th>
                <th className="text-right">Success</th>
                <th className="text-right">Errors</th>
                <th className="text-right">Avg New</th>
                <th>Last Run</th>
              </tr>
            </thead>
            <tbody>
              {crawlSummary.map((r, i) => (
                <tr key={i}>
                  <td className="font-medium">{r.source_name}</td>
                  <td className="text-right font-mono">{r.total}</td>
                  <td className="text-right font-mono text-green-700">{r.success}</td>
                  <td className="text-right font-mono text-red-600">{r.errors}</td>
                  <td className="text-right font-mono text-gray-500">{r.avg_new ?? '—'}</td>
                  <td className="text-xs text-gray-400 whitespace-nowrap">
                    {fmtDate(r.last_run)}
                  </td>
                </tr>
              ))}
              {crawlSummary.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-4">No crawl history yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Recent errors ────────────────────────────────────── */}
      <section>
        <h2 className="headline text-xl font-bold mb-4 pb-1 border-b border-gray-300">Recent Crawl Errors &amp; Warnings</h2>
        <div className="bg-white border border-gray-200 overflow-auto rounded">
          <table className="w-full admin-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Level</th>
                <th>Message</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {crawlErrors.map((r, i) => (
                <tr key={i}>
                  <td className="font-medium">{r.source_name}</td>
                  <td>
                    <span className={r.level === 'error' ? 'text-red-600 font-bold' : 'text-yellow-600'}>
                      {r.level}
                    </span>
                  </td>
                  <td className="text-xs text-gray-600 max-w-xs truncate">{r.message}</td>
                  <td className="text-xs text-gray-400 whitespace-nowrap">
                    {fmtDate(r.created_at)}
                  </td>
                </tr>
              ))}
              {crawlErrors.length === 0 && (
                <tr><td colSpan={4} className="text-center text-gray-400 py-4">No errors logged</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Classification status ────────────────────────────── */}
      <section>
        <h2 className="headline text-xl font-bold mb-4 pb-1 border-b border-gray-300">Classification Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Articles',  value: classifierStats.total },
            { label: 'Classified',      value: classifierStats.classified },
            { label: 'Pending',         value: classifierStats.unclassified },
            { label: 'Tagged Unknown',  value: classifierStats.unknown_count },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded p-4">
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Recently Classified Articles</h3>
        <div className="bg-white border border-gray-200 overflow-auto rounded">
          <table className="w-full admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Bias Tag</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentClassified.map(r => {
                const color = BIAS_COLOURS[r.bias_tag ?? 'unclassified'] ?? '#6b7280';
                return (
                  <tr key={r.id}>
                    <td className="text-sm max-w-sm truncate">{r.title}</td>
                    <td className="text-gray-500 text-sm">{r.source_name}</td>
                    <td>
                      <span className="text-xs font-semibold capitalize" style={{ color }}>
                        {r.bias_tag ?? 'unclassified'}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400 whitespace-nowrap">
                      {fmtDate(r.classified_at)}
                    </td>
                  </tr>
                );
              })}
              {recentClassified.length === 0 && (
                <tr><td colSpan={4} className="text-center text-gray-400 py-4">No articles classified yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
