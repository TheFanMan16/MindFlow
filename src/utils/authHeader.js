/**
 * Authorization header for backend calls.
 *
 * The backend derives the acting user from this token. Sending a userId in the
 * request body instead lets any caller act as any user, so routes that spend
 * quota or touch a user's data must send this header.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Builds an Authorization header from the current Supabase session.
 *
 * @returns {Promise<{Authorization: string}>}
 * @throws {Error} with a message safe to show the user, if there is no session
 */
export async function getAuthHeader() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error('Could not read your session. Please sign in again.');
  }

  const token = data?.session?.access_token;
  if (!token) {
    throw new Error('You need to be signed in to use this feature.');
  }

  return { Authorization: `Bearer ${token}` };
}
