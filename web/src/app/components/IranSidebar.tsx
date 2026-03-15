import { db } from '@/lib/db';

export interface SidebarArticle {
  id: string;
  title: string;
  url: string;
  published_date: Date | null;
  source_name: string;
  source_color: string;
}

function relativeTime(val: Date | null): string {
  if (!val) return '';
  const diff = Date.now() - new Date(val).getTime();
  if (isNaN(diff)) return '';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export async function fetchIranArticles(): Promise<SidebarArticle[]> {
  const { rows } = await db.query<SidebarArticle>(
    `SELECT
       a.id, a.title, a.url,
       COALESCE(a.published_date, a.inferred_date, a.created_at) AS published_date,
       s.name AS source_name, s.color AS source_color
     FROM articles a
     JOIN sources s ON a.source_id = s.id
     WHERE s.active = TRUE
       AND (
         'iran'     = ANY(a.content_tags) OR
         'war'      = ANY(a.content_tags) AND a.title ILIKE '%iran%' OR
         a.title    ILIKE '%iran%' OR
         a.summary  ILIKE '%iran%'
       )
       AND COALESCE(a.published_date, a.inferred_date, a.created_at) >= NOW() - INTERVAL '7 days'
     ORDER BY
       (s.name = 'NBC News') DESC,
       COALESCE(a.published_date, a.inferred_date, a.created_at) DESC
     LIMIT 20`,
  );
  return rows;
}

export function IranSidebar({ articles }: { articles: SidebarArticle[] }) {
  return (
    <div className="col-lg-3">
      <div className="card border-0 shadow-sm" style={{ borderRadius: '8px' }}>
        <div
          className="card-header border-0 text-white fw-bold"
          style={{ backgroundColor: '#b91c1c', borderRadius: '8px 8px 0 0', fontSize: '0.8rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
        >
          Iran War Coverage
        </div>
        <div className="card-body p-0">
          {articles.length === 0 ? (
            <p className="text-muted text-center py-4 mb-0" style={{ fontSize: '0.8rem' }}>
              No Iran coverage found in the last 7 days.
            </p>
          ) : (
            <ul className="list-unstyled mb-0">
              {articles.map((a, i) => (
                <li
                  key={a.id}
                  className={i < articles.length - 1 ? 'border-bottom' : ''}
                  style={{ padding: '0.65rem 0.85rem' }}
                >
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span
                      className="badge text-white"
                      style={{ backgroundColor: a.source_color, fontSize: '0.55rem', flexShrink: 0 }}
                    >
                      {a.source_name}
                    </span>
                    {a.published_date && (
                      <span className="text-muted" style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>
                        {relativeTime(a.published_date)}
                      </span>
                    )}
                  </div>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-decoration-none"
                    style={{ color: '#1a1a1a', fontSize: '0.8rem', lineHeight: '1.35', display: 'block', fontWeight: 500 }}
                  >
                    {a.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
