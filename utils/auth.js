/**
 * Request Authentication
 *
 * Verifies the Supabase JWT sent by the browser and attaches the authenticated
 * user to the request. Routes that act on a user's data must derive the user id
 * from here, never from the request body - a body field is a claim, not proof.
 *
 * Both middlewares deny by default: any missing, malformed, expired or
 * unverifiable token is rejected before the handler runs.
 */

/**
 * Reads the bearer token from the Authorization header.
 * @returns {string|null} the token, or null if absent/malformed
 */
function readBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Builds middleware that requires a valid Supabase session.
 * On success sets req.user to the verified Supabase user.
 *
 * @param {object} supabaseAdmin - service-role Supabase client
 */
function createRequireAuth(supabaseAdmin) {
  return async function requireAuth(req, res, next) {
    const token = readBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !data || !data.user) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      req.user = data.user;
      return next();
    } catch (err) {
      // Never leak verification internals to the caller
      console.error('Auth verification failed:', err.message);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  };
}

/**
 * Builds middleware that requires the authenticated user to be an admin.
 * Must run after requireAuth. Reads is_admin with the service-role client so
 * the check cannot be influenced by the caller's own row-level permissions.
 *
 * @param {object} supabaseAdmin - service-role Supabase client
 */
function createRequireAdmin(supabaseAdmin) {
  return async function requireAdmin(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('is_admin')
        .eq('id', req.user.id)
        .single();

      if (error) {
        console.error('Admin check failed for user:', req.user.id, error.message);
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (profile?.is_admin !== true) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      return next();
    } catch (err) {
      console.error('Admin check errored:', err.message);
      return res.status(403).json({ error: 'Not authorized' });
    }
  };
}

module.exports = { createRequireAuth, createRequireAdmin };
