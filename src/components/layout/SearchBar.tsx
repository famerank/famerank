'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface SearchResult {
  id:                string;
  channel_name:      string;
  profile_image_url: string | null;
  rank_position:     number | null;
  rank_score:        number | null;
}

export default function SearchBar() {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<SearchResult[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router       = useRouter();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, []);

  const closeAndClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        router.push(`/creator/${results[activeIndex].id}`);
        closeAndClear();
      } else if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        closeAndClear();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && query.length >= 1 && (results.length > 0 || !loading);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className="relative flex items-center">
        <svg
          className="absolute left-3.5 w-4 h-4 text-ink-400 pointer-events-none flex-shrink-0"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Search creators…"
          autoComplete="off"
          aria-label="Search creators"
          aria-expanded={open}
          aria-controls="search-dropdown"
          aria-activedescendant={activeIndex >= 0 ? `sr-${activeIndex}` : undefined}
          role="combobox"
          aria-autocomplete="list"
          className="w-full h-10 pl-10 pr-9 bg-ink-100 border border-ink-200 rounded text-sm text-ink-950 placeholder-ink-400 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/20 focus:bg-white transition-all"
        />

        <div className="absolute right-3">
          {loading ? (
            <svg className="w-3.5 h-3.5 text-ink-400 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : query ? (
            <button
              onClick={clear}
              aria-label="Clear search"
              className="text-ink-400 hover:text-ink-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          id="search-dropdown"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-ink-200 rounded shadow-[0_8px_24px_rgba(0,0,0,0.10)] z-50 overflow-hidden"
        >
          {results.length > 0 ? (
            <>
              {results.map((r, i) => (
                <Link
                  key={r.id}
                  id={`sr-${i}`}
                  role="option"
                  aria-selected={activeIndex === i}
                  href={`/creator/${r.id}`}
                  onClick={closeAndClear}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-ink-100 last:border-b-0 transition-colors ${
                    activeIndex === i ? 'bg-gold-50' : 'hover:bg-ink-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-ink-200 bg-ink-100">
                    {r.profile_image_url ? (
                      <Image
                        src={r.profile_image_url}
                        alt={r.channel_name}
                        width={36}
                        height={36}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-ink-400">
                        {r.channel_name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Name + rank */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-950 truncate">{r.channel_name}</p>
                    {r.rank_position != null && (
                      <p className="text-[11px] text-ink-400 mt-0.5">
                        Global Rank #{r.rank_position.toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Score */}
                  {r.rank_score != null && (
                    <span className="flex-shrink-0 text-sm font-mono font-bold text-gold-600 tabular-nums">
                      {Number(r.rank_score).toFixed(1)}
                    </span>
                  )}
                </Link>
              ))}

              {/* View all */}
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                onClick={closeAndClear}
                className="flex items-center justify-between px-4 py-2.5 bg-ink-50 border-t border-ink-200 text-[12px] font-medium text-gold-600 hover:bg-gold-50 hover:text-gold-500 transition-colors"
              >
                <span>View all results for &ldquo;{query}&rdquo;</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </>
          ) : (
            <p className="px-4 py-5 text-sm text-ink-400 text-center">
              No creators found for &ldquo;{query}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
