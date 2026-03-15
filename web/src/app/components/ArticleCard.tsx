'use client';

export interface Article {
  id: number;
  title: string;
  summary: string | null;
  content: string | null;
  content_tags: string[] | null;
  url: string;
  image_url: string | null;
  author: string | null;
  published_date: string | Date | null;
  is_breaking: boolean;
  bias_tag: string | null;
  source_name: string;
  source_color: string;
}

const BIAS_COLOURS: Record<string, string> = {
  'left':         '#2563eb',
  'center-left':  '#60a5fa',
  'center':       '#6b7280',
  'center-right': '#fb923c',
  'right':        '#dc2626',
};

function relativeTime(val: string | Date | null): string {
  if (!val) return '';
  const diff = Date.now() - new Date(val as string).getTime();
  if (isNaN(diff)) return '';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ArticleCard({ article }: { article: Article }) {
  const showBias  = article.bias_tag && article.bias_tag !== 'unknown';
  const biasColor = showBias ? (BIAS_COLOURS[article.bias_tag!] ?? '#6b7280') : null;
  const tags      = article.content_tags?.filter(Boolean) ?? [];
  const excerpt   = (article.summary ?? article.content ?? '').slice(0, 180).trimEnd();

  return (
    <div className="card h-100 shadow-sm border-0" style={{ borderRadius: '8px', overflow: 'hidden' }}>
      {article.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/image?url=${encodeURIComponent(article.image_url)}`}
          className="card-img-top"
          alt=""
          style={{ height: '160px', objectFit: 'cover' }}
        />
      )}

      <div className="card-body d-flex flex-column p-3">
        {/* Source + time row */}
        <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
          <span
            className="badge text-white text-truncate"
            style={{ backgroundColor: article.source_color, fontSize: '0.6rem', maxWidth: '55%' }}
          >
            {article.source_name}
          </span>
          <span className="text-muted" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
            {article.is_breaking && (
              <span className="badge bg-danger me-1" style={{ fontSize: '0.55rem' }}>BREAKING</span>
            )}
            {relativeTime(article.published_date)}
          </span>
        </div>

        {/* Headline */}
        <h6 className="card-title mb-2 fw-bold" style={{ fontSize: '0.92rem', lineHeight: '1.35' }}>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="stretched-link text-decoration-none"
            style={{ color: 'inherit' }}
          >
            {article.title}
          </a>
        </h6>

        {/* Excerpt */}
        {excerpt && (
          <p className="card-text mb-2 text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.45' }}>
            {excerpt}{article.summary && article.summary.length > 180 ? '…' : ''}
          </p>
        )}

        {/* Tags + bias at bottom */}
        {(tags.length > 0 || showBias) && (
          <div className="mt-auto pt-2 d-flex flex-wrap gap-1">
            {tags.map(tag => (
              <span
                key={tag}
                className="badge"
                style={{ backgroundColor: '#e9ecef', color: '#495057', fontSize: '0.58rem' }}
              >
                {tag}
              </span>
            ))}
            {showBias && biasColor && (
              <span
                className="badge ms-auto"
                style={{ backgroundColor: biasColor + '22', color: biasColor, fontSize: '0.58rem' }}
              >
                {article.bias_tag}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
