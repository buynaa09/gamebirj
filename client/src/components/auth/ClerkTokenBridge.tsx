import { useAuth } from '@clerk/react';
import { setAuthTokenProvider } from '../../services/api';

/**
 * Registers Clerk's session-JWT supplier for the plain service modules.
 * Assigned during render (idempotent) so the provider exists before any
 * data-fetching effect runs — no first-request race.
 */
export function ClerkTokenBridge() {
  const { getToken } = useAuth();
  setAuthTokenProvider(() => getToken());
  return null;
}
