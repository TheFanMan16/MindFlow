import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { snappy, reduced } from '../../motion/transitions';

/**
 * Anchored popover menu. bg-raised, soft border, the modal shadow,
 * fadeScale entrance from its anchor edge. Closes on outside click, Escape,
 * or item selection.
 *
 * Positioned ABSOLUTELY against its trigger wrapper, not fixed: the app
 * shell renders inside PageTransition's transform context, where
 * position:fixed pins to the transformed ancestor. Absolute positioning is
 * immune, at the cost of needing overflow room - fine for menus anchored in
 * the shell.
 *
 * Keyboard: the trigger and items sit in DOM order so Tab traverses them
 * visually; ArrowUp/Down/Home/End walk enabled items; Escape (or selecting)
 * closes and hands focus back to the trigger, so keyboard users never fall
 * out to <body>. Focus rings come from the global :focus-visible rule -
 * items declare none of their own.
 */
export const Popover = ({ trigger, children, side = 'bottom', align = 'start', className = '' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const reduce = useReducedMotion();
  const id = useId();

  const close = useCallback(() => {
    setOpen(false);
    // If focus was inside (keyboard selection, Escape), return it to the
    // trigger; if the user clicked elsewhere, leave focus where it went.
    const root = rootRef.current;
    if (root && root.contains(document.activeElement)) {
      root.firstElementChild?.focus?.();
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const menu = menuRef.current;
      if (!menu) return;
      const items = Array.from(menu.querySelectorAll('[role="menuitem"]:not([disabled])'));
      if (items.length === 0) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      let next;
      if (e.key === 'Home') next = items[0];
      else if (e.key === 'End') next = items[items.length - 1];
      else if (e.key === 'ArrowDown') next = i < 0 ? items[0] : items[Math.min(i + 1, items.length - 1)];
      else next = i < 0 ? items[items.length - 1] : items[Math.max(i - 1, 0)];
      next.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const pos = [
    side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
    align === 'end' ? 'right-0' : 'left-0',
  ].join(' ');

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {React.cloneElement(React.Children.only(trigger), {
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
      })}
      <AnimatePresence>
        {open ? (
          <motion.div
            id={id}
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: side === 'top' ? 4 : -4 }}
            animate={
              reduce
                ? { opacity: 1, transition: reduced }
                : { opacity: 1, scale: 1, y: 0, transition: snappy }
            }
            exit={{ opacity: 0, transition: reduced }}
            className={`absolute z-40 min-w-[180px] rounded-lg border border-line bg-raised p-1 shadow-raised ${pos}`}
            onClick={close}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/**
 * One row of a popover menu. rounded-md inside the menu's rounded-lg + 4px
 * padding (nested radius rule: 14 - 4 = 10). Hover fills bg-hover at the
 * 120ms micro duration; pressed steps to bg-active; disabled drops to the
 * disabled text tier and leaves the tab order (a real disabled button, so
 * arrow-key walking skips it too).
 */
export const PopoverItem = ({
  children,
  onSelect,
  danger = false,
  disabled = false,
  className = '',
}) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={disabled ? undefined : onSelect}
    className={[
      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-body-sm',
      'transition-colors duration-micro',
      disabled
        ? 'text-disabled'
        : danger
          ? 'text-negative hover:bg-negative-wash active:bg-active'
          : 'text-primary hover:bg-hover active:bg-active',
      className,
    ].join(' ')}
  >
    {children}
  </button>
);

/** Hairline separator between menu groups - the faint internal-divider weight. */
export const PopoverSeparator = () => (
  <div role="separator" aria-orientation="horizontal" className="mx-1 my-1 border-t border-faint" />
);

export default Popover;
