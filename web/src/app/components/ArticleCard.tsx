'use client';

import Link      from 'next/link';
import SourceBadge from './SourceBadge';

export interface Article {
  id: number;
  title: string;
  summary: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  published_date: string | null;
  is_breaking: boolean;
  bias_tag: string | null;
  source_name: string;
  source_color: string;
}

interface ArticleCardProps {
  article: Article;
  /** 'lead' = big top story, 'secondary' = medium story, 'brief' = compact list item */
  variant?: 'lead' | 'secondary' | 'brief';
}

const BIAS_COLOURS: Record<string, string> = {
  'left':         '#2563eb',
  'center-left':  '#60a5fa',
  'center':       '#6b7280',
  'center-right': '#fb923c',
  'right':        '#dc2626',
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Get display paragraphs: prefer rich content, fall back to summary */
function getBodyParagraphs(article: Article, maxParas: number): string[] {
  const contentText = (article.content ?? '').trim();
  const summaryText = (article.summary ?? '').trim();
  // Use content if it's substantially more than the summary
  if (contentText.length > summaryText.length + 80) {
    return contentText.split('\n').filter(p => p.trim().length > 0).slice(0, maxParas);
  }
  // Otherwise, use summary as body text
  if (summaryText) return [summaryText];
  return [];
}

export default function ArticleCard({ article, variant = 'secondary' }: ArticleCardProps) {
  const showBias = article.bias_tag && article.bias_tag !== 'unknown';
  const biasColor = showBias ? (BIAS_COLOURS[article.bias_tag!] ?? '#6b7280') : undefined;

  if (variant === 'brief') {
    return (
      <li className="article-brief">
        <SourceBadge name={article.source_name} color={article.source_color} />
        {' '}
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="brief-title">
          {article.title}
        </a>
        {article.summary && (
          <p className="brief-summary">{article.summary}</p>
        )}
        <span className="article-time">{article.published_date ? relativeTime(article.published_date) : ''}</span>
      </li>
    );
  }

  const paragraphs = getBodyParagraphs(article, variant === 'lead' ? 8 : 3);
  const hasMultiPara = paragraphs.length >= 2 && paragraphs.join('').length > 200;

  return (
    <article className={`article-card article-card--${variant}`}>
      {article.is_breaking && (
        <span className="breaking-label">Breaking</span>
      )}
      {article.image_url && (variant === 'lead' || variant === 'secondary') && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/image?url=${encodeURIComponent(article.image_url)}`}
          alt=""
          className={variant === 'lead' ? 'article-image' : 'article-image article-image--sm'}
        />
      )}
      <div className="article-meta">
        <SourceBadge name={article.source_name} color={article.source_color} />
        {showBias && biasColor && (
          <span className="bias-tag" style={{ color: biasColor }} title={`Bias: ${article.bias_tag}`}>
            {article.bias_tag}
          </span>
        )}
        <span className="article-time">{article.published_date ? relativeTime(article.published_date) : ''}</span>
      </div>
      <h2 className={`article-headline article-headline--${variant}`}>
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          {article.title}
        </a>
      </h2>
      {article.author && <p className="article-byline">By {article.author}</p>}

      {paragraphs.length > 0 && (
        <div className={
          variant === 'lead' && hasMultiPara
            ? 'article-body article-body--columns'
            : 'article-body'
        }>
          {paragraphs.map((para, i) => <p key={i}>{para.trim()}</p>)}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="read-more"
          >
            Read full story ›
          </a>
        </div>
      )}
    </article>
  );
}
