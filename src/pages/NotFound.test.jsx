import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import NotFound from './NotFound';

const appSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'App.jsx'),
  'utf8'
);

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <NotFound />
    </MemoryRouter>
  );
}

describe('NotFound', () => {
  it('says plainly that the page does not exist', () => {
    renderAt('/this-page-does-not-exist-12345');

    expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
    // The old oversized "404" numeral was decoration off the type scale;
    // the sentence carries the information now, so the numeral must stay gone.
    expect(screen.queryByText('404')).toBeNull();
  });

  it('shows which path failed, so a typo is distinguishable from a bug', () => {
    renderAt('/reccall');

    expect(screen.getByText('/reccall')).toBeInTheDocument();
  });

  it('offers a way back', () => {
    renderAt('/nope');

    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });
});

describe('App routing', () => {
  it('renders NotFound for unknown paths instead of silently going home', () => {
    // Previously: <Route path="*" element={<Navigate to="/" replace />} />
    // which made a typo, a dead link and a broken route indistinguishable.
    expect(appSource).toContain('<NotFound />');
  });

  it('routes /recall to the Active Recall page, matching the nav label', () => {
    expect(appSource).toContain('path="/recall"');
    // The old URL keeps working for bookmarks.
    expect(appSource).toMatch(/path="\/blurting" element=\{<Navigate to="\/recall"/);
  });

  it('keeps the narrow recovery-flow redirects', () => {
    // The password-recovery and OAuth-callback branches legitimately bounce
    // unknown paths; only the main router should render a 404.
    const navigateCatchAlls = appSource.match(/path="\*" element=\{<Navigate/g) || [];
    expect(navigateCatchAlls).toHaveLength(2);
  });
});
