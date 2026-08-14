import React, { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from '../motion';
import { snappy, reduced } from '../motion/transitions';
import { Skeleton } from './ui';

/**
 * Global command palette. Cmd+K / Ctrl+K from anywhere: navigate, start a
 * session, create a deck. fadeScale entrance, full keyboard model
 * (type-to-filter, arrows, Enter, Escape; Tab is trapped while open -
 * focus never leaves the input, so it has nowhere legitimate to go).
 *
 * Two selection states, deliberately distinct: pointer hover is a quiet
 * bg-hover fill that never steals the keyboard's place, while the
 * arrow-key selection carries bg-accent-wash plus a 2px accent bar (and
 * aria-selected), so it survives grayscale and a wandering mouse alike.
 * Enter always runs the KEYBOARD selection; a click runs the row under
 * the pointer. The input reports the selection via aria-activedescendant
 * so focus never has to leave the field.
 *
 * `loading` (for callers that source commands async) swaps the list for
 * static skeleton rows cut to the exact row metrics (36px rows, label
 * and hint bars) - nothing shifts when real rows land, nothing pulses.
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

export const CommandPalette = ({ loading = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

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
    } else if (e.key === 'Tab') {
      // DOM focus lives on the input for the palette's whole life
      // (aria-activedescendant) - Tab in either direction could only walk
      // behind the scrim, so trap it, mirroring the Modal contract.
      e.preventDefault();
    } else if (loading) {
      // Nothing to traverse or run until commands arrive.
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // No match under the cursor: keep the palette open so the query can
      // be corrected instead of silently closing on a dead Enter.
      if (results[index]) run(results[index]);
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
          {/* Scrim: the canvas token faded up, matching ui/Modal - the
              animated opacity IS the 0.8, so no opacity class to fight. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={reduced}
            className="absolute inset-0 bg-canvas"
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
            {/* py-1.5 + h-9 keeps the row at its old 48px while giving the
                input's 2px+2px focus outline room to render inside the
                overflow-hidden shell instead of clipping at the top. */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-1.5">
              <span className="text-label-sm text-tertiary" aria-hidden="true">
                ⌘K
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Where to?"
                aria-label="Search commands"
                aria-controls={listId}
                aria-activedescendant={
                  !loading && results[index] ? `${listId}-opt-${index}` : undefined
                }
                className="h-9 w-full bg-transparent text-body text-primary placeholder:text-secondary"
              />
            </div>

            <div
              ref={listRef}
              id={listId}
              className="max-h-[300px] overflow-y-auto p-1.5"
              role="listbox"
              aria-busy={loading || undefined}
            >
              {loading ? (
                /* Static placeholder cut to the real row metrics: one group
                   label (12px bar) and five 36px rows with label + hint bars,
                   so the loaded list lands without a shift. */
                <div aria-hidden="true">
                  <div className="flex h-8 items-end px-3 pb-1">
                    <Skeleton className="h-3 w-14" />
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex h-9 items-center justify-between gap-3 px-3">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  ))}
                </div>
              ) : results.length === 0 ? (
                <p className="px-3 py-6 text-center text-body-sm text-secondary">
                  Nothing matches “{query}”.
                </p>
              ) : (
                ['Navigate', 'Actions'].map((group) => {
                  const items = results.filter((c) => c.group === group);
                  if (items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="px-3 pb-1 pt-2.5 text-label-sm text-secondary">
                        {group}
                      </p>
                      {items.map((cmd) => {
                        flatIndex += 1;
                        const active = flatIndex === index;
                        return (
                          <button
                            key={`${group}-${cmd.label}`}
                            id={`${listId}-opt-${flatIndex}`}
                            type="button"
                            role="option"
                            aria-selected={active}
                            data-active={active}
                            onClick={() => run(cmd)}
                            className={[
                              'group relative flex w-full items-center justify-between gap-3 rounded-[4px] px-3 py-2 text-left',
                              'transition-colors duration-micro hover:bg-hover active:bg-active',
                              active ? 'bg-accent-wash text-primary' : 'text-secondary',
                            ].join(' ')}
                          >
                            {active ? (
                              <span
                                className="absolute inset-y-1 left-0 w-0.5 bg-accent"
                                aria-hidden="true"
                              />
                            ) : null}
                            <span className="text-body-sm font-medium">{cmd.label}</span>
                            {/* Secondary, not tertiary: the panel is raised
                                and rows fill on hover/active - tertiary
                                measures under 4.5:1 on all three grounds. */}
                            <span className="truncate text-label-sm text-secondary">
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
                <span key={what} className="flex items-center gap-1.5 text-label-sm text-secondary">
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
