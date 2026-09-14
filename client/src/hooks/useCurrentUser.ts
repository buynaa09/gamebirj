import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import type { User } from '../types';

/**
 * Backend profile for the signed-in Clerk user.
 * Same `{ user, loading }` shape as the old session AuthContext, so pages
 * gate on it unchanged. `user` is null when signed out or the profile
 * fetch fails; `loading` covers both Clerk hydration and the profile fetch.
 */
export function useCurrentUser(): { user: User | null; loading: boolean } {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [trackedId, setTrackedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ id: string; user: User | null } | null>(null);

  const currentId = isSignedIn ? (userId ?? null) : null;
  if (trackedId !== currentId) {
    // Identity changed (sign in, sign out, account switch): drop the stale profile.
    setTrackedId(currentId);
    setProfile(null);
  }

  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (!isLoaded || !isSignedIn || currentId === null || profileId === currentId) return;
    let cancelled = false;
    apiGet<User>('/users/me/').then(
      (me) => {
        if (!cancelled) setProfile({ id: currentId, user: me });
      },
      () => {
        if (!cancelled) setProfile({ id: currentId, user: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, currentId, profileId]);

  if (!isLoaded) return { user: null, loading: true };
  if (!isSignedIn || currentId === null) return { user: null, loading: false };
  if (profileId !== currentId) return { user: null, loading: true };
  return { user: profile?.user ?? null, loading: false };
}
