import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lightbulb, LayoutGrid, Timer, Zap, BookOpen, Layers, Settings, LogOut, User, LogIn, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion } from '../motion';
import { snappy } from '../motion/transitions';
import { Popover, PopoverItem, PopoverSeparator, Button } from './ui';

/**
 * App navigation, three responsive forms driven by CSS alone (no JS media
 * queries, no remounts):
 *   > 1100px  full rail - icon + 13px label rows
 *   641-1100  icon rail - same rows, labels hidden
 *   <= 640    bottom tab bar
 *
 * The active indicator is a layoutId pill that physically slides between
 * items on navigation - the shell's signature micro-interaction. Rail and
 * tab bar carry separate layoutIds; only one is visible at a time.
 *
 * Flat by law: bg-subtle surface, hairline right border, 18px/1.5 Lucide
 * icons, accent for the active item. No glows, no per-mode colors.
 */

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
        className="flex shrink-0 items-center justify-center rounded-pill bg-accent-wash text-small font-semibold text-accent"
      >
        {initial}
      </span>
    );

  const userMenu = (trigger) => (
    <Popover side="top" trigger={trigger}>
      <div className="px-2.5 pb-1.5 pt-2">
        <p className="truncate text-small font-medium text-primary">{profile?.full_name || 'Signed in'}</p>
        <p className="truncate font-mono text-micro text-tertiary">{email}</p>
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
      <aside className="hidden h-full w-[68px] shrink-0 flex-col border-r border-soft bg-subtle sm:flex nav:w-[220px]">
        {/* Brand */}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex h-14 items-center gap-2.5 border-b border-soft px-[22px]
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          aria-label="MindFlow home"
        >
          <Lightbulb size={20} strokeWidth={1.5} className="shrink-0 text-accent" />
          <span className="hidden text-small font-semibold text-primary nav:block">MindFlow</span>
        </button>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 p-2.5" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(location.pathname || '/', item);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className="relative flex h-9 items-center gap-3 rounded-input px-2.5
                           transition-colors duration-150
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              >
                {active ? (
                  <motion.span
                    layoutId="active-nav"
                    transition={snappy}
                    className="absolute inset-0 rounded-input border border-soft bg-elevated"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={`relative z-10 shrink-0 transition-colors duration-150 ${
                    active ? 'text-accent' : 'text-secondary'
                  }`}
                />
                <span
                  className={`relative z-10 hidden text-small nav:block ${
                    active ? 'font-medium text-primary' : 'text-secondary'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* User block */}
        <div className="border-t border-soft p-2.5">
          {user ? (
            userMenu(
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-input px-2 py-2 transition-colors
                           duration-150 hover:bg-elevated focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-accent-ring"
              >
                <Avatar />
                <span className="hidden min-w-0 flex-1 truncate text-left font-mono text-micro text-secondary nav:block">
                  {email}
                </span>
                <ChevronUp size={14} strokeWidth={1.5} className="hidden shrink-0 text-tertiary nav:block" />
              </button>
            )
          ) : (
            <>
              <div className="hidden nav:block">
                <Button size="sm" className="w-full" onClick={() => navigate('/login')}>
                  Sign in
                </Button>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                aria-label="Sign in"
                className="flex h-9 w-full items-center justify-center rounded-input text-secondary
                           transition-colors duration-150 hover:bg-elevated hover:text-primary
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring nav:hidden"
              >
                <LogIn size={18} strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* -------------------------------------------- bottom tab bar ----- */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-soft bg-subtle
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
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              >
                {active ? (
                  <motion.span
                    layoutId="active-tab"
                    transition={snappy}
                    className="absolute inset-x-2 inset-y-1 rounded-input bg-elevated"
                    aria-hidden="true"
                  />
                ) : null}
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={`relative z-10 ${active ? 'text-accent' : 'text-secondary'}`}
                />
                <span
                  className={`relative z-10 max-w-full truncate text-[10px] leading-none ${
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
