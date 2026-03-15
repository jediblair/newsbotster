'use client';

import { useState, useCallback } from 'react';
import Link                       from 'next/link';
import ArticleCard, { Article }   from './components/ArticleCard';

const PAGE_SIZE = 30;

interface Props {
  initial:  Article[];
  breaking: Article[];
  date:     string;
  prevDay:  string | null;
  nextDay:  string | null;
}

export default function FrontPageClient({ initial, breaking, date, prevDay, nextDay }: Props) {
  const [articles, setArticles] = useState<Article[]>(initial);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [exhausted, setExhausted] = useState(initial.length < PAGE_SIZE);

  const loadMore = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      date,
      page:  String(page + 1),
      limit: String(PAGE_SIZE),
    });
    const res  = await fetch(`/api/articles?${params}`);
    const json = await res.json();
    const data: Article[] = json.articles ?? [];
    if (data.length < PAGE_SIZE) setExhausted(true);
    setArticles(prev => [...prev, ...data]);
    setPage(p => p + 1);
    setLoading(false);
  }, [date, page]);

  return (
    <div className="container-fluid px-3 py-3" style={{ maxWidth: '1400px', margin: '0 auto' }}>

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
      <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
        {articles.map(article => (
          <div key={article.id} className="col">
            <ArticleCard article={article} />
          </div>
        ))}
        {articles.length === 0 && (
          <div className="col-12 text-center text-muted py-5">
            <p className="mb-0">No articles found for {date}.</p>
          </div>
        )}
      </div>

      {/* Load more */}
      {!exhausted && (
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
          <Link href={`/day/${prevDay}`} className="btn btn-sm btn-outline-secondary">
            ← {prevDay}
          </Link>
        ) : <span />}
        <span className="text-muted small">{date}</span>
        {nextDay ? (
          <Link href={`/day/${nextDay}`} className="btn btn-sm btn-outline-secondary">
            {nextDay} →
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}

