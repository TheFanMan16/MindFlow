/**
 * Guards that billing routes act on the caller's own account only.
 *
 * /create-portal-session returns a live Stripe Customer Portal URL - invoices,
 * payment methods, plan changes. Before these guards it accepted any userId
 * from the request body with no authentication.
 *
 * Source-text assertions; server.js exits on a missing STRIPE_SECRET_KEY and
 * cannot be imported. See serverRoutes.test.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverSource = readFileSync(resolve(root, 'server.js'), 'utf8');

/** Returns a route handler's source, from registration to the next route. */
function handlerBody(method, path) {
  const start = serverSource.indexOf(`app.${method}('${path}'`);
  if (start === -1) return null;
  const rest = serverSource.slice(start + 1);
  const nextOffset = rest.search(/\napp\.(post|get)\(/);
  return nextOffset === -1 ? rest : rest.slice(0, nextOffset);
}

const BILLING_ROUTES = [
  ['post', '/create-checkout-session'],
  ['post', '/cancel-subscription'],
  ['get', '/get-subscription-details'],
  ['post', '/get-subscription-details'],
  ['post', '/api/user/sync-subscription'],
];

describe('billing route authentication', () => {
  it.each(BILLING_ROUTES)('%s %s is registered behind requireAuth', (method, path) => {
    const body = handlerBody(method, path);
    expect(body).not.toBeNull();

    const registration = body.slice(0, body.indexOf('=> {'));
    expect(registration).toContain('requireAuth');
  });

  it.each(BILLING_ROUTES)('%s %s does not read userId from body or query', (method, path) => {
    const body = handlerBody(method, path);
    expect(body).not.toMatch(/const\s*\{[^}]*\buserId\b[^}]*\}\s*=\s*req\.(body|query)/);
  });

  it('guards both portal-session aliases', () => {
    expect(serverSource).toMatch(
      /app\.post\('\/create-portal-session',\s*requireAuth,\s*handleCreatePortalSession\)/
    );
    expect(serverSource).toMatch(
      /app\.post\('\/api\/create-portal-session',\s*requireAuth,\s*handleCreatePortalSession\)/
    );
  });

  it('resolves the portal customer from the verified session', () => {
    const handler = serverSource.slice(serverSource.indexOf('async function handleCreatePortalSession'));
    expect(handler).toContain('req.user.id');
    expect(handler.slice(0, handler.indexOf('}'))).not.toContain('req.body');
  });
});

describe('Stripe redirect URLs', () => {
  it('never hardcodes localhost in a Stripe redirect', () => {
    const redirects = serverSource.match(/(success_url|cancel_url|return_url):\s*[^,\n]+/g) || [];

    expect(redirects.length).toBeGreaterThan(0);
    for (const line of redirects) {
      expect(line).not.toContain('localhost');
      expect(line).toContain('appBaseUrl');
    }
  });

  it('points the billing portal at a route that exists', () => {
    // /subscription was never a route in App.jsx; /settings is.
    const appSource = readFileSync(resolve(root, 'src', 'App.jsx'), 'utf8');
    const returnUrls = serverSource.match(/return_url:\s*`\$\{appBaseUrl\}([^`]*)`/g) || [];

    expect(returnUrls.length).toBeGreaterThan(0);
    for (const url of returnUrls) {
      const path = url.match(/\$\{appBaseUrl\}([^`]*)/)[1];
      expect(appSource).toContain(`path="${path}"`);
    }
  });
});
