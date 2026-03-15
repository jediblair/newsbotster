'use client';

import { ReactNode, useState }         from 'react';
import { useSearchParams, useRouter }  from 'next/navigation';
import FrontPageClient                 from './FrontPageClient';
import FilterPanel                     from './FilterPanel';
import type { Article }                from './components/ArticleCard';

export interface FilterSource { id: number; name: string; color: string; }

interface Props {
  initial:       Article[];
  breaking:      Article[];
  date:          string;
  prevDay:       string | null;
  nextDay?:      string | null;
  sources:       FilterSource[];
  availableTags: string[];
  sidebar:       ReactNode;
}

export default function HomeClient({
  initial, breaking, date, prevDay, nextDay = null, sources, availableTags, sidebar,
}: Props) {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [activeSources, setActiveSources] = useState<number[]>(() => {
    const s = searchParams.get('sources');
    return s ? s.split(',').map(Number).filter(n => n > 0) : [];
  });
  const [activeTags, setActiveTags] = useState<string[]>(() => {
    const t = searchParams.get('tags');
    return t ? t.split(',').filter(Boolean) : [];
  });

  function updateUrl(sources: number[], tags: string[]) {
    const p = new URLSearchParams();
    if (sources.length > 0) p.set('sources', sources.join(','));
    if (tags.length    > 0) p.set('tags',    tags.join(','));
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  function toggleSource(id: number) {
    const next = activeSources.includes(id)
      ? activeSources.filter(s => s !== id)
      : [...activeSources, id];
    setActiveSources(next);
    updateUrl(next, activeTags);
  }

  function toggleTag(tag: string) {
    const next = activeTags.includes(tag)
      ? activeTags.filter(t => t !== tag)
      : [...activeTags, tag];
    setActiveTags(next);
    updateUrl(activeSources, next);
  }

  function clearFilters() {
    setActiveSources([]);
    setActiveTags([]);
    updateUrl([], []);
  }

  return (
    <div className="row g-4">
      {/* Filter panel — hidden on mobile */}
      <div className="col-lg-2 d-none d-lg-block">
        <FilterPanel
          sources={sources}
          availableTags={availableTags}
          activeSources={activeSources}
          activeTags={activeTags}
          onSourceToggle={toggleSource}
          onTagToggle={toggleTag}
          onClear={clearFilters}
        />
      </div>

      {/* Article feed */}
      <div className="col-12 col-lg-7">
        <FrontPageClient
          initial={initial}
          breaking={breaking}
          date={date}
          prevDay={prevDay}
          nextDay={nextDay}
          activeSources={activeSources}
          activeTags={activeTags}
        />
      </div>

      {/* Iran war sidebar (server-rendered, passed in as ReactNode) */}
      {sidebar}
    </div>
  );
}
