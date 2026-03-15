'use client';

import { useState, useCallback } from 'react';
import Link                       from 'next/link';
import ArticleCard, { Article }   from './components/ArticleCard';

const ABOVE_FOLD  = 10;  // stories rendered immediately
const PAGE_SIZE   = 12;  // additional stories per "load more"

interface Props {
  initial:  Article[];
  breaking: Article[];
  date:     string; // ISO date string YYYY-MM-DD
  prevDay:  string | null;
  nextDay:  string | null;
}

export default function FrontPageClient({ initial, breaking, date, prevDay, nextDay }: Props) {
  const [articles, setArticles]       = useState<Article[]>(initial);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [exhausted, setExhausted]     = useState(initial.length < ABOVE_FOLD);
  const [scrollBreakPassed, setScrollBreakPassed] = useState(false);

  const loadMore = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      date,
      page:  String(page + 1),
      limit: String(PAGE_SIZE),
    });
    const res = await fetch(`/api/articles?${params}`);
    const json = await res.json();
    const data: Article[] = json.articles ?? [];
    if (data.length < PAGE_SIZE) setExhausted(true);
    setArticles(prev => [...prev, ...data]);
    setPage(p => p + 1);
    setLoading(false);
  }, [date, page]);

  // Stories above the fold / scroll break
  const topStories  = articles.slice(0, ABOVE_FOLD);
  // Stories below the scroll break (loaded after user clicks continue)
  const moreStories = articles.slice(ABOVE_FOLD);

  const lead      = topStories[0];
  const secondary = topStories.slice(1, 4);
  const briefs    = topStories.slice(4);

  return (
    <>
      {/* ── Breaking news banner ───────────────────────── */}
      {breaking.length > 0 && (
        <div className="breaking-banner">
          <span className="breaking-label">Breaking</span>{' '}
          <a href={breaking[0].url} target="_blank" rel="noopener noreferrer">
            {breaking[0].title}
          </a>
        </div>
      )}

      {/* ── Main newspaper grid ────────────────────────── */}
      <div className="newspaper-grid">
        {/* Lead story — full width */}
        {lead && (
          <div className="col-full">
            <ArticleCard article={lead} variant="lead" />
          </div>
        )}

        {/* Two secondary stories */}
        <div className="col-two-thirds">
          {secondary.map(a => (
            <ArticleCard key={a.id} article={a} variant="secondary" />
          ))}
        </div>

        {/* Brief sidebar */}
        <div className="col-one-third sidebar">
          <h3 className="sidebar-heading">In Brief</h3>
          <ul className="brief-list">
            {briefs.map(a => (
              <ArticleCard key={a.id} article={a} variant="brief" />
            ))}
          </ul>
        </div>
      </div>

      {/* ── Doom-scroll break ──────────────────────────── */}
      {!scrollBreakPassed && moreStories.length === 0 && !exhausted && (
        <div className="scroll-break">
          <p>You&rsquo;ve reached the end of the above-the-fold edition.</p>
          <button
            className="scroll-break-btn"
            onClick={() => { setScrollBreakPassed(true); loadMore(); }}
          >
            Continue reading &darr;
          </button>
        </div>
      )}

      {/* ── Stories below the fold ─────────────────────── */}
      {scrollBreakPassed && (
        <div className="newspaper-grid below-fold">
          {moreStories.map(a => (
            <div key={a.id} className="col-one-third">
              <ArticleCard article={a} variant="secondary" />
            </div>
          ))}
        </div>
      )}

      {/* ── Load more ──────────────────────────────────── */}
      {scrollBreakPassed && !exhausted && (
        <div className="load-more-row">
          <button
            className="load-more-btn"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more stories'}
          </button>
        </div>
      )}

      {/* ── Day navigation ─────────────────────────────── */}
      <nav className="day-nav">
        {prevDay ? (
          <Link href={`/day/${prevDay}`} className="day-nav-link">
            &larr; {prevDay}
          </Link>
        ) : <span />}
        <span className="day-nav-date">{date}</span>
        {nextDay ? (
          <Link href={`/day/${nextDay}`} className="day-nav-link">
            {nextDay} &rarr;
          </Link>
        ) : <span />}
      </nav>
    </>
  );
}
