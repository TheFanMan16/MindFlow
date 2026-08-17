import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Route components are behind React.lazy. If one ever renders outside a Suspense
// boundary React throws during render, not at build time - the bundle would
// build cleanly and then white-screen. Mounting the real App catches that here.

vi.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      // App holds its loading gate up until INITIAL_SESSION arrives, which the
      // real client emits immediately. Without it no route ever renders.
      onAuthStateChange: vi.fn((cb) => {
        setTimeout(() => cb('INITIAL_SESSION', null), 0);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({ sentryTriggered: false, setSentryTriggered: vi.fn(), user: null, loading: false }),
  AuthProvider: ({ children }) => children,
}));

vi.mock('./context/ProfileContext', () => ({
  ProfileProvider: ({ children }) => children,
  useProfile: () => ({ profile: null }),
}));

import App from './App';

describe('App lazy routes', () => {
  it('resolves a lazy route chunk without a missing-Suspense error', async () => {
    render(
      <MemoryRouter initialEntries={['/about']}>
        <App />
      </MemoryRouter>
    );

    const heading = await screen.findByRole('heading', { name: /About MindFlow/i }, { timeout: 5000 });
    expect(heading).toBeTruthy();
  });
});
