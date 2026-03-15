'use client';

import type { FilterSource } from './HomeClient';

interface Props {
  sources:       FilterSource[];
  availableTags: string[];
  activeSources: number[];
  activeTags:    string[];
  onSourceToggle: (id: number) => void;
  onTagToggle:    (tag: string) => void;
  onClear:        () => void;
}

export default function FilterPanel({
  sources, availableTags, activeSources, activeTags,
  onSourceToggle, onTagToggle, onClear,
}: Props) {
  const hasFilters = activeSources.length > 0 || activeTags.length > 0;

  return (
    <div style={{ fontSize: '0.8rem', position: 'sticky', top: '1rem' }}>

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', fontWeight: 700 }}>
          Filter
        </span>
        {hasFilters && (
          <button
            onClick={onClear}
            className="btn btn-link p-0 text-decoration-none"
            style={{ fontSize: '0.65rem', color: '#aaa' }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Sources */}
      <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '6px' }}>
        Sources
      </p>
      <div className="d-flex flex-column gap-1 mb-3">
        {sources.map(s => {
          const active = activeSources.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onSourceToggle(s.id)}
              title={s.name}
              style={{
                fontSize: '0.72rem',
                padding: '4px 8px',
                border: 'none',
                borderRadius: '4px',
                textAlign: 'left',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                backgroundColor: active ? s.color : '#f0f0f0',
                color: active ? '#fff' : '#333',
                transition: 'background-color 0.12s, color 0.12s',
              }}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Topics */}
      {availableTags.length > 0 && (
        <>
          <p style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '6px' }}>
            Topics
          </p>
          <div className="d-flex flex-wrap gap-1">
            {availableTags.map(tag => {
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onTagToggle(tag)}
                  style={{
                    fontSize: '0.62rem',
                    padding: '2px 8px',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    backgroundColor: active ? '#1a1a1a' : '#e8e8e8',
                    color: active ? '#fff' : '#555',
                    transition: 'background-color 0.12s, color 0.12s',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
