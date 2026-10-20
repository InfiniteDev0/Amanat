'use client';

import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { cn } from '@/lib/utils';

/**
 * The search box at the top of the page: a filled pill with the magnifier,
 * "Search", and the shortcut at the end (Ctrl K, ⌘K on a Mac), which jumps
 * into it from anywhere. What it searches comes next.
 */
export function SearchBar({ className }: { className?: string }) {
  const t = useTranslations('search');
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  // ⌘K on a Mac; Ctrl K on the server and everywhere else.
  const mac = useSyncExternalStore(
    () => () => undefined,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <label className={cn('bg-field focus-within:bg-field-focus hover:bg-field-focus flex h-10 items-center gap-2.5 rounded-xl px-3.5 transition-colors', className)}>
      <SearchIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <input
        ref={input}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && input.current?.blur()}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd className="text-muted-foreground hidden shrink-0 font-sans text-xs sm:block">{mac ? t('shortcutMac') : t('shortcut')}</kbd>
    </label>
  );
}
