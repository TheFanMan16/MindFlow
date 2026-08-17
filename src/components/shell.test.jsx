import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CommandPalette from './CommandPalette';
import Sidebar from './Sidebar';
import MiniTimer from './MiniTimer';
import ErrorBoundary from './ErrorBoundary';

vi.mock('../context/AuthContext', () => {
  const AUTH = {
    user: { id: 'u1', email: 'student@example.com' },
    profile: { email: 'student@example.com' },
    signOut: vi.fn(),
  };
  return { useAuth: () => AUTH };
});

/** Mutable timer state the TimerContext mock reads - set per test. */
const timerMock = vi.hoisted(() => ({ current: null }));
vi.mock('../context/TimerContext', () => ({
  useTimer: () => ({ timerState: timerMock.current }),
}));

vi.mock('../lib/errors', () => ({ reportError: vi.fn() }));

/** Records where the router currently is, so navigation can be asserted. */
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const renderShell = (ui, initial = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      {ui}
      <LocationProbe />
      <Routes>
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>
  );

describe('CommandPalette', () => {
  it('opens on Ctrl+K, filters, and navigates on Enter', async () => {
    renderShell(<CommandPalette />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByLabelText('Search commands');

    fireEvent.change(input, { target: { value: 'focus' } });
    // "Focus" (navigate) is the first match; Enter runs it.
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('location')).toHaveTextContent('/focus');
    // The palette exits through a 150ms fade - wait for the removal.
    await waitFor(() =>
      expect(screen.queryByLabelText('Search commands')).not.toBeInTheDocument()
    );
  });

  it('supports arrow-key selection and Escape', async () => {
    renderShell(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = await screen.findByLabelText('Search commands');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const selected = screen.getAllByRole('option').find((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveTextContent('Focus');
    // The input tracks the keyboard selection for assistive tech.
    expect(input).toHaveAttribute('aria-activedescendant', selected.id);

    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByLabelText('Search commands')).not.toBeInTheDocument()
    );
  });

  it('keeps the keyboard selection independent of pointer hover', async () => {
    renderShell(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await screen.findByLabelText('Search commands');

    const options = screen.getAllByRole('option');
    // Hovering the last row must NOT steal the keyboard's place...
    fireEvent.mouseEnter(options[options.length - 1]);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'false');

    // ...but a click still runs the row under the pointer.
    fireEvent.click(screen.getByRole('option', { name: /Settings/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
  });

  it('shows one sentence for an empty result and keeps the palette open on Enter', async () => {
    renderShell(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByLabelText('Search commands');

    fireEvent.change(input, { target: { value: 'zzzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();

    // A dead Enter must not close the palette - the query gets corrected.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByLabelText('Search commands')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });

  it('loading replaces rows with a static placeholder and disarms the keyboard', async () => {
    renderShell(<CommandPalette loading />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByLabelText('Search commands');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    // Nothing to run yet: Enter neither navigates nor closes.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByLabelText('Search commands')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard');
  });
});

describe('Sidebar', () => {
  it('renders all primary destinations and marks the active one', () => {
    renderShell(<Sidebar />, '/focus');
    // Rail + bottom bar both render; use getAllBy and check the rail's row.
    const focusButtons = screen.getAllByRole('button', { name: 'Focus' });
    expect(focusButtons.length).toBeGreaterThan(0);
    const current = focusButtons.find((b) => b.getAttribute('aria-current') === 'page');
    expect(current).toBeTruthy();
    // The active route is marked by more than color: the label gains weight.
    expect(current.querySelector('.font-medium')).toBeTruthy();

    for (const label of ['Dashboard', 'Recall', 'Feynman', 'Cards']) {
      expect(screen.getAllByRole('button', { name: label }).length).toBeGreaterThan(0);
    }
  });

  it('navigates from a nav item', () => {
    renderShell(<Sidebar />, '/dashboard');
    fireEvent.click(screen.getAllByRole('button', { name: 'Recall' })[0]);
    expect(screen.getByTestId('location')).toHaveTextContent('/recall');
  });

  it('leans on the app-wide focus ring instead of local overrides', () => {
    renderShell(<Sidebar />, '/dashboard');
    for (const b of screen.getAllByRole('button')) {
      expect(b.className).not.toMatch(/focus-visible:outline-none|focus-visible:ring|focus:outline-none/);
    }
  });

  it('opens the user menu with profile, settings and sign out', async () => {
    renderShell(<Sidebar />);
    // The rail's user block trigger carries the email.
    fireEvent.click(screen.getAllByRole('button', { expanded: false }).find((b) => b.textContent.includes('student@example.com')));
    expect(await screen.findByRole('menuitem', { name: /Sign out/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Profile/i })).toBeInTheDocument();
  });
});

describe('MiniTimer', () => {
  it('renders nothing without a running session', () => {
    timerMock.current = null;
    renderShell(<MiniTimer />);
    expect(screen.queryByRole('button', { name: /return to session/ })).not.toBeInTheDocument();
  });

  it('shows the running session and returns to /focus on press', () => {
    timerMock.current = { mode: 'pomodoro', isRunning: true, timeRemaining: 902, timeElapsed: 0 };
    renderShell(<MiniTimer />, '/recall');
    const pill = screen.getByRole('button', { name: /Pomodoro running, 15:02/ });

    fireEvent.click(pill);
    expect(screen.getByTestId('location')).toHaveTextContent('/focus');
    // Back on the focus route, the full timer owns the screen - pill gone.
    expect(screen.queryByRole('button', { name: /return to session/ })).not.toBeInTheDocument();
  });

  it('stays hidden on the focus route itself', () => {
    timerMock.current = { mode: 'flowmodoro', isRunning: true, timeRemaining: 0, timeElapsed: 61 };
    renderShell(<MiniTimer />, '/focus');
    expect(screen.queryByRole('button', { name: /return to session/ })).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  it('names what broke and offers exactly one reload action', () => {
    // React logs caught render errors; keep the test output clean.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new Error('deck list exploded');
    };

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(
      screen.getByText(/could not recover from: deck list exploded/)
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument();
    // The stack stays available behind a collapsed details element.
    expect(screen.getByText('Error details')).toBeInTheDocument();

    quiet.mockRestore();
  });

  it('renders children untouched when nothing has thrown', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });
});
