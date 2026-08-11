import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from '../motion';
import { snappy, reduced } from '../motion/transitions';

/**
 * Global command palette. Cmd+K / Ctrl+K from anywhere: navigate, start a
 * session, create a deck. fadeScale entrance, full keyboard model
 * (type-to-filter, arrows, Enter, Escape).
 *
 * Portals to document.body (PageTransition's transform context would trap
 * position:fixed). Mounted once in the app shell.
 */

const COMMANDS = [
  { group: 'Navigate', label: 'Dashboard', hint: 'Overview and today’s plan', to: '/dashboard' },
  { group: 'Navigate', label: 'Focus', hint: 'Deep work timer', to: '/focus' },
  { group: 'Navigate', label: 'Recall', hint: 'Blurt what you remember', to: '/recall' },
  { group: 'Navigate', label: 'Feynman', hint: 'Explain it to learn it', to: '/feynman' },
  { group: 'Navigate', label: 'Flashcards', hint: 'Decks and spaced review', to: '/flashcards' },
  { group: 'Navigate', label: 'Settings', hint: 'Account and preferences', to: '/settings' },
  { group: 'Navigate', label: 'Profile', hint: 'Stats and progress', to: '/profile' },
  { group: 'Actions', label: 'Start a focus session', hint: 'Open the timer', to: '/focus' },
  { group: 'Actions', label: 'Start today’s loop', hint: 'Review what’s due', to: '/flashcards' },
  { group: 'Actions', label: 'Create a deck', hint: 'From notes or a PDF', to: '/flashcards' },
  { group: 'Actions', label: 'Panic mode', hint: 'Exam soon — triage', to: '/panic' },
];

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q)
    );
  }, [query]);

  // Global shortcut. metaKey covers macOS, ctrlKey covers Windows/Linux.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      // Focus after the entrance frame so the browser does not scroll-jump.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  const run = useCallback(
    (cmd) => {
      setOpen(false);
      if (cmd?.to) navigate(cmd.to);
    },
    [navigate]
  );

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[index]);
    }
  };

  // Keep the active row visible while arrowing through a long list.
  // (scrollIntoView is optional-called: jsdom does not implement it.)
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [index]);

  let flatIndex = -1;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[18vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced}
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
            animate={
              reduce
                ? { opacity: 1, transition: reduced }
                : { opacity: 1, scale: 1, y: 0, transition: snappy }
            }
            exit={{ opacity: 0, transition: reduced }}
            className="relative w-full max-w-lg overflow-hidden rounded-lg border border-line bg-raised shadow-raised"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <span className="text-label-sm text-tertiary" aria-hidden="true">
                ⌘K
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Where to?"
                aria-label="Search commands"
                className="h-12 w-full bg-transparent text-body text-primary placeholder:text-tertiary focus:outline-none"
              />
            </div>

            <div ref={listRef} className="max-h-[300px] overflow-y-auto p-1.5" role="listbox">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-body-sm text-secondary">
                  Nothing matches “{query}”.
                </p>
              ) : (
                ['Navigate', 'Actions'].map((group) => {
                  const items = results.filter((c) => c.group === group);
                  if (items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="px-3 pb-1 pt-2.5 text-label-sm text-tertiary">
                        {group}
                      </p>
                      {items.map((cmd) => {
                        flatIndex += 1;
                        const active = flatIndex === index;
                        const i = flatIndex;
                        return (
                          <button
                            key={`${group}-${cmd.label}`}
                            type="button"
                            role="option"
                            aria-selected={active}
                            data-active={active}
                            onMouseEnter={() => setIndex(i)}
                            onClick={() => run(cmd)}
                            className={[
                              'flex w-full items-center justify-between gap-3 rounded-[4px] px-3 py-2 text-left',
                              'transition-colors duration-150',
                              active ? 'bg-accent-wash text-primary' : 'text-secondary',
                            ].join(' ')}
                          >
                            <span className="text-body-sm font-medium">{cmd.label}</span>
                            <span className="truncate text-label-sm text-tertiary">
                              {cmd.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-line px-4 py-2">
              {[
                ['↑↓', 'navigate'],
                ['↵', 'select'],
                ['esc', 'close'],
              ].map(([key, what]) => (
                <span key={what} className="flex items-center gap-1.5 text-label-sm text-tertiary">
                  <kbd className="rounded-[3px] border border-line bg-surface px-1 py-0.5">{key}</kbd>
                  {what}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
};

export default CommandPalette;
