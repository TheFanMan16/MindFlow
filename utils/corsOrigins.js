/**
 * CORS origin allowlist.
 *
 * This decides which frontends the browser will let call the API. It is not the
 * primary access control - every non-webhook route still requires a verified
 * JWT - but a wrong list makes a correctly deployed frontend look completely
 * broken, because the page loads and then every request fails.
 *
 * The list is configured through the environment so that adding a domain does
 * not require a code change and a redeploy of the backend.
 */

const LOCALHOST_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

// Used when ALLOWED_ORIGINS is not set, so an existing deployment that has not
// had the variable added yet keeps working exactly as before.
const LEGACY_PRODUCTION_ORIGIN = 'https://mind-flow-two-dusky.vercel.app';

/**
 * Splits a comma-separated origin list, trimming blanks and trailing slashes.
 * @param {string|undefined} raw
 * @returns {string[]}
 */
function parseOriginList(raw) {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Builds the matcher for Vercel preview deployments.
 *
 * Preview URLs are `<project>-<hash>-<scope>.vercel.app` and
 * `<project>-git-<branch>-<scope>.vercel.app`, where `<scope>` is your Vercel
 * team or username slug. We anchor on that trailing scope rather than the
 * project prefix on purpose: anyone can create a Vercel project whose name
 * starts with "mind-flow", which would satisfy a prefix match and - because we
 * send credentials - hand a stranger's page authenticated access. Only you can
 * deploy under your own scope, so the suffix is the part that actually proves
 * ownership.
 *
 * @param {string|undefined} scope Vercel team/username slug
 * @returns {RegExp|null} null when previews are not enabled
 */
function buildPreviewMatcher(scope) {
  const slug = (scope || '').trim().toLowerCase();
  if (!slug) {
    return null;
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(
      `VERCEL_PREVIEW_SCOPE must be a Vercel slug ([a-z0-9-]), received: ${scope}`
    );
  }
  return new RegExp(`^https://[a-z0-9-]+-${slug}\\.vercel\\.app$`);
}

/**
 * Resolves the full set of allowed origins from the environment.
 *
 * @param {object} env process.env or a stand-in
 * @returns {{origins: string[], previewMatcher: RegExp|null, allowLocalhost: boolean}}
 */
function resolveOriginPolicy(env = {}) {
  const isProduction = env.NODE_ENV === 'production';
  const configured = parseOriginList(env.ALLOWED_ORIGINS);

  // Localhost is a development convenience, not something a deployed API should
  // trust by default. If you do need to point a local frontend at the deployed
  // backend, name the origin explicitly in ALLOWED_ORIGINS.
  const allowLocalhost = !isProduction;

  const origins = new Set(configured.length > 0 ? configured : [LEGACY_PRODUCTION_ORIGIN]);
  if (allowLocalhost) {
    LOCALHOST_ORIGINS.forEach((origin) => origins.add(origin));
  }

  return {
    origins: [...origins],
    previewMatcher: buildPreviewMatcher(env.VERCEL_PREVIEW_SCOPE),
    allowLocalhost,
  };
}

/**
 * Returns true when `origin` is allowed under `policy`.
 * @param {string} origin
 * @param {ReturnType<typeof resolveOriginPolicy>} policy
 * @returns {boolean}
 */
function isOriginAllowed(origin, policy) {
  if (typeof origin !== 'string' || origin === '') {
    return false;
  }
  const normalised = origin.trim().replace(/\/+$/, '');
  if (policy.origins.includes(normalised)) {
    return true;
  }
  return Boolean(policy.previewMatcher && policy.previewMatcher.test(normalised.toLowerCase()));
}

/**
 * Builds the `origin` callback for the cors middleware.
 * @param {object} env
 * @returns {function(string|undefined, function): void}
 */
function createOriginChecker(env = {}) {
  const policy = resolveOriginPolicy(env);

  return function originChecker(origin, callback) {
    // Requests with no Origin header are not cross-site browser requests -
    // server-to-server calls, curl, and health checks land here. They are still
    // subject to authentication on every route that matters.
    if (!origin) {
      return callback(null, true);
    }
    if (isOriginAllowed(origin, policy)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  };
}

module.exports = {
  LOCALHOST_ORIGINS,
  LEGACY_PRODUCTION_ORIGIN,
  parseOriginList,
  buildPreviewMatcher,
  resolveOriginPolicy,
  isOriginAllowed,
  createOriginChecker,
};
