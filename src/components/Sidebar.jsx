import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lightbulb, LayoutGrid, Timer, Zap, BookOpen, Layers, Settings, LogOut, User, LogIn, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, useReducedMotion } from '../motion';
import { pop, smooth, reduced } from '../motion/transitions';
import { Popover, PopoverItem, PopoverSeparator, Button } from './ui';

/**
 * App navigation, two responsive forms driven by CSS alone (no JS media
 * queries, no remounts):
 *   > 640px   minimalist rail - 68px of icons at rest, springs out to 184px
 *             on pointer hover OR keyboard focus-within. The expansion is an
 *             OVERLAY (the rail's flow placeholder stays 68px), so content
 *             never reflows under it. Labels are ALWAYS in the DOM - the
 *             panel's overflow clips them at rest and they slide in on
 *             expansion; every control also carries an aria-label, so the
 *             rail reads identically to assistive tech in both states.
 *             Collapse waits 150ms so skimming the edge does not flap it.
 *   <= 640    bottom tab bar (labels under the icons)
 *
 * The active indicator is a layoutId pill that physically slides between
 * items on navigation - the shell's signature micro-interaction. Rail and
 * tab bar carry separate layoutIds; only one is visible at a time.
 *
 * Nav item state model: default text-secondary · hover bg-hover fill at
 * duration-micro · pressed bg-active · focus rides the app-wide ring (no
 * local overrides, so index.css shows through) · the active route is marked
 * by MORE than color - raised pill + hairline border + font-medium label +
 * aria-current, so it survives grayscale. Items can carry `disabled: true`
 * and drop out of the pointer and tab order in text-disabled.
 *
 * Flat by law: bg-surface surface, hairline right border, 18px/1.5 Lucide
 * icons, accent for the active item. The expanded overlay carries
 * shadow-raised - it genuinely floats above content. No glows, no per-mode
 * colors.
 */

const RAIL_REST = 68;
const RAIL_OPEN = 184;

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutGrid, match: ['/dashboard', '/'] },
  { path: '/focus', label: 'Focus', icon: Timer, match: ['/focus', '/study'] },
  { path: '/recall', label: 'Recall', icon: Zap, match: ['/recall', '/blurting'] },
  { path: '/feynman', label: 'Feynman', icon: BookOpen, match: ['/feynman'] },
  { path: '/flashcards', label: 'Cards', icon: Layers, match: ['/flashcards'] },
];

const isActivePath = (pathname, item) =>
  item.match.some((m) => (m === '/' ? pathname === '/' : pathname.startsWith(m)));

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user, signOut } = useAuth();
  const reduce = useReducedMotion();

  // Expansion state: pointer in OR focus within. Collapse is debounced
  // 150ms (hover intent); expand is immediate.
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef(null);
  const openRail = () => {
    clearTimeout(collapseTimer.current);
    setExpanded(true);
  };
  const closeRail = () => {
    clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setExpanded(false), 150);
  };
  useEffect(() => () => clearTimeout(collapseTimer.current), []);

  /** Label that slides in as the rail opens; clipped by the rail at rest. */
  const RailLabel = ({ children, className = '' }) => (
    <motion.span
      initial={false}
      animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -6 }}
      transition={reduce ? reduced : pop}
      className={`whitespace-nowrap ${className}`}
    >
      {children}
    </motion.span>
  );

  const email = profile?.email || user?.email || '';
  const initial = (profile?.full_name || email || 'U').charAt(0).toUpperCase();

  const Avatar = ({ size = 28 }) =>
    profile?.avatar_url ? (
      <img
        src={profile.avatar_url}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-pill object-cover"
      />
    ) : (
      <span
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-pill bg-accent-wash text-body-sm font-semibold text-accent"
      >
        {initial}
      </span>
    );

  const userMenu = (trigger) => (
    <Popover side="top" trigger={trigger}>
      <div className="px-2.5 pb-1.5 pt-2">
        <p className="truncate text-body-sm font-medium text-primary">{profile?.full_name || 'Signed in'}</p>
        <p className="truncate text-label-sm text-tertiary">{email}</p>
      </div>
      <PopoverSeparator />
      <PopoverItem onSelect={() => navigate('/profile')}>
        <User size={15} strokeWidth={1.5} /> Profile
      </PopoverItem>
      <PopoverItem onSelect={() => navigate('/settings')}>
        <Settings size={15} strokeWidth={1.5} /> Settings
      </PopoverItem>
      <PopoverSeparator />
      <PopoverItem danger onSelect={() => signOut && signOut()}>
        <LogOut size={15} strokeWidth={1.5} /> Sign out
      </PopoverItem>
    </Popover>
  );

  return (
    <>
      {/* ------------------------------------------------ side rail ------ */}
      {/* Flow placeholder: layout is built against the 68px rest width; the
          animated rail overlays content when it expands, so nothing reflows. */}
      <div className="relative hidden h-full w-[68px] shrink-0 sm:block">
        <motion.aside
          onPointerEnter={openRail}
          onPointerLeave={closeRail}
          onFocusCapture={openRail}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) closeRail();
          }}
          initial={false}
          animate={{ width: expanded ? RAIL_OPEN : RAIL_REST }}
          transition={reduce ? reduced : smooth}
          className={`absolute inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-line bg-surface ${
            expanded ? 'shadow-raised' : 'shadow-edge'
          }`}
        >
        {/* Brand - icon column is fixed at x=22 in both states, so nothing
            jumps while the rail breathes. */}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex h-11 shrink-0 items-center gap-3 border-b border-faint px-[22px]
                     transition-colors duration-micro hover:bg-hover active:bg-active"
          aria-label="MindFlow home"
        >
          <Lightbulb size={18} strokeWidth={1.5} className="shrink-0 text-accent" />
          <RailLabel className="font-mono uppercase text-label-mono text-primary">
            MindFlow
          </RailLabel>
        </button>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-2.5 py-2.5" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(location.pathname || '/', item);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                disabled={item.disabled}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className="relative flex h-[34px] items-center gap-3 rounded-sm px-3
                           after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-['']
                           transition-colors duration-micro
                           hover:bg-hover active:bg-active disabled:pointer-events-none"
              >
                {active ? (
                  <motion.span
                    layoutId="active-nav"
                    transition={pop}
                    className="absolute inset-0 rounded-sm border border-line bg-raised"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={`relative z-10 shrink-0 transition-colors duration-micro ${
                    item.disabled ? 'text-disabled' : active ? 'text-accent' : 'text-secondary'
                  }`}
                />
                <RailLabel
                  className={`relative z-10 text-body-sm ${
                    item.disabled
                      ? 'text-disabled'
                      : active
                        ? 'font-medium text-primary'
                        : 'text-secondary'
                  }`}
                >
                  {item.label}
                </RailLabel>
              </button>
            );
          })}
        </nav>

        {/* User block */}
        <div className="shrink-0 border-t border-line p-2.5">
          {user ? (
            userMenu(
              <button
                type="button"
                aria-label="Account menu"
                className="flex w-full items-center gap-2.5 rounded-sm px-2 py-2 transition-colors
                           duration-micro hover:bg-hover active:bg-active"
              >
                <Avatar />
                <RailLabel className="min-w-0 flex-1 truncate text-left text-label-sm text-secondary">
                  {email}
                </RailLabel>
                <RailLabel>
                  <ChevronUp size={14} strokeWidth={1.5} className="shrink-0 text-tertiary" />
                </RailLabel>
              </button>
            )
          ) : expanded ? (
            <Button size="sm" className="w-full" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          ) : (
            /* Collapsed rest state: the same action as an icon; the label
               arrives with the expansion. */
            <button
              type="button"
              onClick={() => navigate('/login')}
              aria-label="Sign in"
              className="flex h-11 w-full items-center justify-center rounded-sm text-secondary
                         transition-colors duration-micro hover:bg-hover hover:text-primary
                         active:bg-active"
            >
              <LogIn size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>
        </motion.aside>
      </div>

      {/* -------------------------------------------- bottom tab bar ----- */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface
                   pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {[...NAV_ITEMS, user ? { path: '/profile', label: 'Profile', icon: User, match: ['/profile'] } : { path: '/login', label: 'Sign in', icon: LogIn, match: ['/login'] }].map(
          (item) => {
            const active = isActivePath(location.pathname || '/', item);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2
                           transition-colors duration-micro active:bg-active"
              >
                {active ? (
                  <motion.span
                    layoutId="active-tab"
                    transition={pop}
                    className="absolute inset-x-2 inset-y-1 rounded-sm bg-raised"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={`relative z-10 ${active ? 'text-accent' : 'text-secondary'}`}
                />
                <span
                  className={`relative z-10 max-w-full truncate text-label-xs leading-none ${
                    active ? 'font-medium text-primary' : 'text-secondary'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }
        )}
      </nav>
    </>
  );
};

export default Sidebar;
