import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CommandPalette from './CommandPalette';
import Sidebar from './Sidebar';

vi.mock('../context/AuthContext', () => {
  const AUTH = {
    user: { id: 'u1', email: 'student@example.com' },
    profile: { email: 'student@example.com' },
    signOut: vi.fn(),
  };
  return { useAuth: () => AUTH };
});

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

    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByLabelText('Search commands')).not.toBeInTheDocument()
    );
  });
});

describe('Sidebar', () => {
  it('renders all primary destinations and marks the active one', () => {
    renderShell(<Sidebar />, '/focus');
    // Rail + bottom bar both render; use getAllBy and check the rail's row.
    const focusButtons = screen.getAllByRole('button', { name: 'Focus' });
    expect(focusButtons.length).toBeGreaterThan(0);
    expect(focusButtons.some((b) => b.getAttribute('aria-current') === 'page')).toBe(true);

    for (const label of ['Dashboard', 'Recall', 'Feynman', 'Cards']) {
      expect(screen.getAllByRole('button', { name: label }).length).toBeGreaterThan(0);
    }
  });

  it('navigates from a nav item', () => {
    renderShell(<Sidebar />, '/dashboard');
    fireEvent.click(screen.getAllByRole('button', { name: 'Recall' })[0]);
    expect(screen.getByTestId('location')).toHaveTextContent('/recall');
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
