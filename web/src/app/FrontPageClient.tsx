'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link                                         from 'next/link';
import ArticleCard, { Article }                     from './components/ArticleCard';

const PAGE_SIZE = 30;

function filterQs(sources: number[], tags: string[]): string {
  const p = new URLSearchParams();
  if (sources.length > 0) p.set('sources', sources.join(','));
  if (tags.length    > 0) p.set('tags',    tags.join(','));
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}

interface Props {
  initial:        Article[];
  breaking:       Article[];
  date:           string;
  prevDay:        string | null;
  nextDay:        string | null;
  activeSources?: number[];
  activeTags?:    string[];
}

export default function FrontPageClient({
  initial, breaking, date, prevDay, nextDay,
  activeSources = [], activeTags = [],
}: Props) {
  const [articles, setArticles]   = useState<Article[]>(initial);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [exhausted, setExhausted] = useState(initial.length < PAGE_SIZE);
  const isFirstRender             = useRef(true);

  // Stable string keys so the effect only fires when filter contents actually change
  const sourcesKey = activeSources.join(',');
  const tagsKey    = activeTags.join(',');

  // Re-fetch from page 1 whenever filters change.
  // Skip the very first render ONLY if no filters are active — in that case the SSR
  // data is already correct. If filters are present on mount (carried via URL params
  // from a previous day), we must re-fetch immediately because the server rendered
  // unfiltered articles.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!sourcesKey && !tagsKey) return; // SSR data is already correct, skip
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ date, page: '1', limit: String(PAGE_SIZE) });
    if (sourcesKey) params.set('sources', sourcesKey);
    if (tagsKey)    params.set('tags',    tagsKey);

    fetch(`/api/articles?${params}`)
      .then(r => r.json())
      .then((json: { articles?: Article[] }) => {
        if (cancelled) return;
        const data = json.articles ?? [];
        setArticles(data);
        setPage(1);
        setExhausted(data.length < PAGE_SIZE);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sourcesKey, tagsKey, date]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      date,
      page:  String(page + 1),
      limit: String(PAGE_SIZE),
    });
    if (sourcesKey) params.set('sources', sourcesKey);
    if (tagsKey)    params.set('tags',    tagsKey);
    const res  = await fetch(`/api/articles?${params}`);
    const json = await res.json();
    const data: Article[] = json.articles ?? [];
    if (data.length < PAGE_SIZE) setExhausted(true);
    setArticles(prev => [...prev, ...data]);
    setPage(p => p + 1);
    setLoading(false);
  }, [date, page, sourcesKey, tagsKey]);

  const hasFilters = activeSources.length > 0 || activeTags.length > 0;

  return (
    <>
      {/* Breaking news banner */}
      {breaking.length > 0 && (
        <div className="alert alert-danger d-flex align-items-center py-2 mb-3 border-0" role="alert">
          <span className="badge bg-danger me-2 flex-shrink-0">BREAKING</span>
          <a
            href={breaking[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-dark fw-semibold text-decoration-none"
          >
            {breaking[0].title}
          </a>
        </div>
      )}

      {/* Article grid */}
      <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3">
        {loading && articles.length === 0 && (
          <div className="col-12 text-center text-muted py-5">
            <span className="spinner-border spinner-border-sm me-2" role="status" />
            Loading…
          </div>
        )}
        {!loading && articles.length === 0 && (
          <div className="col-12 text-center text-muted py-5">
            <p className="mb-0">
              No articles found{hasFilters ? ' matching these filters' : ` for ${date}`}.
            </p>
          </div>
        )}
        {articles.map(article => (
          <div key={article.id} className="col">
            <ArticleCard article={article} />
          </div>
        ))}
      </div>

      {/* Load more */}
      {!exhausted && articles.length > 0 && (
        <div className="text-center mt-4">
          <button
            className="btn btn-outline-secondary px-4"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                Loading…
              </>
            ) : 'Load more stories'}
          </button>
        </div>
      )}

      {/* Day navigation */}
      <nav className="d-flex justify-content-between align-items-center border-top mt-4 pt-3">
        {prevDay ? (
          <Link href={`/day/${prevDay}${filterQs(activeSources, activeTags)}`} className="btn btn-sm btn-outline-secondary">
            ← {prevDay}
          </Link>
        ) : <span />}
        <span className="text-muted small">{date}</span>
        {nextDay ? (
          <Link href={`/day/${nextDay}${filterQs(activeSources, activeTags)}`} className="btn btn-sm btn-outline-secondary">
            {nextDay} →
          </Link>
        ) : <span />}
      </nav>
    </>
  );
}
