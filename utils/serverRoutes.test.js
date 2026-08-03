/**
 * Route-guard regression tests.
 *
 * server.js calls process.exit(1) when STRIPE_SECRET_KEY is absent, so it
 * cannot be imported in the test environment. These tests assert on the source
 * text instead. That is weaker than booting the app - it proves the middleware
 * is wired, not that it runs - but it does catch the regression that matters:
 * someone removing the guard from a privileged route.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'server.js'),
  'utf8'
);

/** Returns the middleware list a route was registered with, or null. */
function routeRegistration(method, path) {
  const pattern = new RegExp(
    `app\\.${method}\\(\\s*['"\`]${path.replace(/\//g, '\\/')}['"\`]([^)]*)`,
    'm'
  );
  const match = serverSource.match(pattern);
  return match ? match[1] : null;
}

describe('privileged route guards', () => {
  it('registers /admin/delete-user behind requireAuth and requireAdmin', () => {
    const registration = routeRegistration('post', '/admin/delete-user');

    expect(registration).not.toBeNull();
    expect(registration).toContain('requireAuth');
    expect(registration).toContain('requireAdmin');
  });

  it('builds the auth middleware from the service-role client', () => {
    expect(serverSource).toContain('createRequireAuth(supabaseAdmin)');
    expect(serverSource).toContain('createRequireAdmin(supabaseAdmin)');
  });

  it('does not delete accounts using an unverified body field alone', () => {
    // The handler may still read req.body.userId - an admin deleting another
    // user needs a target - but the route must be guarded before it does.
    const registration = routeRegistration('post', '/admin/delete-user');
    expect(registration).toMatch(/requireAuth\s*,\s*requireAdmin/);
  });
});
