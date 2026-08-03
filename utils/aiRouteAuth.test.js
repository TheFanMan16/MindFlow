/**
 * Guards that AI routes bill quota to a verified session rather than a body
 * field. Source-text assertions - server.js cannot be imported because it
 * exits on a missing STRIPE_SECRET_KEY. See serverRoutes.test.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', 'server.js'),
  'utf8'
);

/** Returns the body of a route handler, from its registration to the next app.post. */
function handlerBody(path) {
  const start = serverSource.indexOf(`app.post('${path}'`);
  if (start === -1) return null;
  const next = serverSource.indexOf('\napp.post(', start + 1);
  return serverSource.slice(start, next === -1 ? serverSource.length : next);
}

const AI_ROUTES = ['/api/analyze-feynman', '/api/generate-from-pdf'];

describe('AI route authentication', () => {
  it.each(AI_ROUTES)('%s is registered behind requireAuth', (path) => {
    const body = handlerBody(path);
    expect(body).not.toBeNull();

    const registration = body.slice(0, body.indexOf('=> {'));
    expect(registration).toContain('requireAuth');
  });

  it.each(AI_ROUTES)('%s takes the acting user from the verified token', (path) => {
    const body = handlerBody(path);
    expect(body).toContain('req.user.id');
  });

  it.each(AI_ROUTES)('%s does not destructure userId from the request body', (path) => {
    const body = handlerBody(path);
    // The whole point: a body field is a claim, not proof of identity.
    expect(body).not.toMatch(/const\s*\{[^}]*\buserId\b[^}]*\}\s*=\s*req\.body/);
  });
});
