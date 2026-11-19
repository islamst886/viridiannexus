import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { toast } from 'react-toastify';
import { clearCachedAccessToken, supabase } from '../supabase';
import { mapProfileFromDB, mapPropertyFromDB } from '../utils/mappers';
import {
  ACTIVITY_THROTTLE_MS,
  SESSION_CHECK_INTERVAL_MS,
  SESSION_LOGOUT_EVENT_KEY,
  SESSION_META_STORAGE_KEY,
  broadcastSessionLogout,
  clearAuthTransition,
  clearStoredSessionMeta,
  deriveSessionIdentity,
  evaluateSessionValidity,
  getSessionExpirationMessage,
  isAuthTransitionActive,
  isPrivilegedRole,
  readStoredSessionMeta,
  syncSessionMetaOnAuth,
  touchStoredSessionActivity,
  type SessionExpirationReason,
} from '../utils/sessionManager';
import { normalizeExternalUrl } from '../utils/urlHelpers';
import type {
  NotificationItem,
  ProfileDBRow,
  Property,
  PropertyDBRow,
  SiteSettings,
  UserProfile,
  WishlistItem,
} from '../types';

export interface GlobalStateContextValue {
  authUser: User | null;
  userProfile: UserProfile | null;
  authLoading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  sessionExpiredReason: SessionExpirationReason | null;
  wishlist: WishlistItem[];
  toggleWishlist: (property: Pick<Property, 'id' | 'name' | 'location' | 'price'>) => Promise<boolean>;
  notifications: NotificationItem[];
  markNotificationsRead: () => Promise<void>;
  properties: Property[];
  loadingProperties: boolean;
  fetchProperties: () => Promise<void>;
  adminUnsavedChanges: boolean;
  setAdminUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  bypassUnsavedGuard: boolean;
  setBypassUnsavedGuard: React.Dispatch<React.SetStateAction<boolean>>;
  siteSettings: SiteSettings | null;
  unreadInquiriesCount: number;
  refreshUnreadInquiriesCount: () => Promise<void>;
}

const GlobalStateContext = createContext<GlobalStateContextValue | null>(null);

function sanitizeSiteSettings(raw: unknown): SiteSettings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    facebookUrl: normalizeExternalUrl(obj.facebookUrl),
    youtubeUrl: normalizeExternalUrl(obj.youtubeUrl),
    linkedinUrl: normalizeExternalUrl(obj.linkedinUrl),
    whatsappNumber: typeof obj.whatsappNumber === 'string' ? obj.whatsappNumber : '',
    lastUpdatedAt: typeof obj.lastUpdatedAt === 'string' ? obj.lastUpdatedAt : undefined,
    lastUpdatedBy: typeof obj.lastUpdatedBy === 'string' ? obj.lastUpdatedBy : undefined,
  };
}

export const GlobalStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<SessionExpirationReason | null>(
    null
  );

  const currentSessionRef = useRef<Session | null>(null);
  const expiringSessionRef = useRef(false);
  const idleWarnedRef = useRef(false);
  const lastTouchWriteRef = useRef(0);

  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [adminUnsavedChanges, setAdminUnsavedChanges] = useState(false);
  const [bypassUnsavedGuard, setBypassUnsavedGuard] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [unreadInquiriesCount, setUnreadInquiriesCount] = useState(0);

  const expireCurrentSession = useCallback(
    async (reason: SessionExpirationReason, roleHint?: string | null): Promise<void> => {
      if (expiringSessionRef.current) return;
      expiringSessionRef.current = true;
      idleWarnedRef.current = false;
      currentSessionRef.current = null;

      clearCachedAccessToken();
      clearAuthTransition();
      broadcastSessionLogout(reason);
      setSessionExpiredReason(reason);
      setAuthUser(null);
      setUserProfile(null);
      setWishlist([]);
      setNotifications([]);
      setAuthLoading(false);

      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      } finally {
        expiringSessionRef.current = false;
      }

      toast.warning(getSessionExpirationMessage(reason, isPrivilegedRole(roleHint)));
    },
    []
  );

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const applyAuthenticatedSession = (session: Session | null, isExplicit = false): void => {
      if (!mounted) return;
      const user = session?.user ?? null;

      if (!user || !session) {
        currentSessionRef.current = null;
        clearCachedAccessToken();
        clearStoredSessionMeta();
        setAuthUser(null);
        setUserProfile(null);
        setWishlist([]);
        setNotifications([]);
        setAuthLoading(false);
        return;
      }

      currentSessionRef.current = session;
      const meta = syncSessionMetaOnAuth({ session, isExplicitLogin: isExplicit });
      if (isExplicit) {
        clearAuthTransition();
      }
      const identity = deriveSessionIdentity(session);
      const evaluation = evaluateSessionValidity({
        meta,
        role: 'user',
        serverSignInAt: identity?.serverSignInAt ?? null,
      });

      if (!evaluation.valid) {
        void expireCurrentSession(evaluation.reason ?? 'idle');
        return;
      }

      if (isExplicit) {
        idleWarnedRef.current = false;
        setSessionExpiredReason(null);
      }

      setAuthUser((prevUser) => {
        if (!prevUser || prevUser.id !== user.id) {
          setAuthLoading(true);
        }
        return user;
      });
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      applyAuthenticatedSession(session, isAuthTransitionActive());
      if (session?.user) {
        const meta = readStoredSessionMeta();
        if (meta && meta.userId === session.user.id) {
          const now = Date.now();
          lastTouchWriteRef.current = now;
          touchStoredSessionActivity(session.user.id, now);
        }
      }
    });

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        applyAuthenticatedSession(null, false);
        return;
      }

      if (event === 'SIGNED_IN') {
        applyAuthenticatedSession(session, isAuthTransitionActive());
        return;
      }

      // TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION: preserve existing inactivity clock
      applyAuthenticatedSession(session, false);
    });

    return () => {
      mounted = false;
      authSub.unsubscribe();
    };
  }, [expireCurrentSession]);

  // ── Profile listener ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return;

    const applyLoadedProfile = async (profileRow: ProfileDBRow | null): Promise<void> => {
      if (profileRow?.is_banned) {
        await expireCurrentSession('revoked', profileRow.role);
        toast.error('Your account has been suspended.');
        return;
      }

      const identity = deriveSessionIdentity(currentSessionRef.current);
      const evaluation = evaluateSessionValidity({
        meta: readStoredSessionMeta(),
        role: profileRow?.role,
        serverSignInAt: identity?.serverSignInAt ?? null,
      });

      if (!evaluation.valid) {
        await expireCurrentSession(evaluation.reason ?? 'max_age', profileRow?.role);
        return;
      }

      setUserProfile(mapProfileFromDB(profileRow));
      setAuthLoading(false);
    };

    const fetchProfile = async (): Promise<void> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('[GlobalState] Profile fetch error:', error);
        if (error.code === 'PGRST116') {
          await expireCurrentSession('revoked');
        } else {
          setAuthLoading(false);
        }
        return;
      }

      await applyLoadedProfile(data as ProfileDBRow | null);
    };

    void fetchProfile();

    const profileSub = supabase
      .channel(`profile:${authUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${authUser.id}`,
        },
        (payload) => {
          const data = payload.new as ProfileDBRow | null;
          void applyLoadedProfile(data);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(profileSub);
    };
  }, [authUser, expireCurrentSession]);

  // ── Idle & absolute session lifetime enforcement + cross-tab sync ──────────
  useEffect(() => {
    if (!authUser) return;

    const userId = authUser.id;
    const role = userProfile?.role ?? 'user';
    const identity = deriveSessionIdentity(currentSessionRef.current);

    const checkSessionOrExpire = (): boolean => {
      const evaluation = evaluateSessionValidity({
        meta: readStoredSessionMeta(),
        role,
        serverSignInAt: identity?.serverSignInAt ?? null,
      });

      if (!evaluation.valid) {
        void expireCurrentSession(evaluation.reason ?? 'idle', role);
        return false;
      }

      if (evaluation.shouldWarnIdle && !idleWarnedRef.current) {
        idleWarnedRef.current = true;
        toast.warning('For your security, your session will expire soon due to inactivity.');
      } else if (!evaluation.shouldWarnIdle) {
        idleWarnedRef.current = false;
      }

      return true;
    };

    const handleUserActivity = (): void => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const now = Date.now();
      if (now - lastTouchWriteRef.current < ACTIVITY_THROTTLE_MS) return;

      // Verify the session did not already expire while the tab/PC was sleeping
      if (!checkSessionOrExpire()) return;

      lastTouchWriteRef.current = now;
      idleWarnedRef.current = false;
      touchStoredSessionActivity(userId, now);
    };

    const handleVisibilityOrFocus = (): void => {
      if (typeof document === 'undefined' || !document.hidden) {
        checkSessionOrExpire();
      }
    };

    const handleStorageSync = (event: StorageEvent): void => {
      if (event.key === SESSION_LOGOUT_EVENT_KEY) {
        clearCachedAccessToken();
        currentSessionRef.current = null;
        setAuthUser(null);
        setUserProfile(null);
        setWishlist([]);
        setNotifications([]);
        setAuthLoading(false);
        void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      } else if (event.key === SESSION_META_STORAGE_KEY && !event.newValue) {
        checkSessionOrExpire();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    }
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorageSync);

    const intervalId = window.setInterval(checkSessionOrExpire, SESSION_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleUserActivity);
      }
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, [authUser, userProfile?.role, expireCurrentSession]);

  // ── Wishlist listener ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) {
      setWishlist([]);
      return;
    }

    const fetchWishlist = async (): Promise<void> => {
      const { data } = await supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', authUser.id);
      setWishlist((data as WishlistItem[] | null) ?? []);
    };
    void fetchWishlist();

    const wishlistSub = supabase
      .channel(`wishlist:${authUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wishlist',
          filter: `user_id=eq.${authUser.id}`,
        },
        () => {
          void fetchWishlist();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(wishlistSub);
    };
  }, [authUser?.id]);

  // ── Notifications listener ─────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async (): Promise<void> => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications((data as NotificationItem[] | null) ?? []);
    };
    void fetchNotifications();

    const notifSub = supabase
      .channel(`notifications:${authUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${authUser.id}`,
        },
        () => {
          void fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(notifSub);
    };
  }, [authUser?.id]);

  // ── Properties listener (realtime) ────────────────────────────────────────
  const fetchProperties = useCallback(async (): Promise<void> => {
    const { data, error } = await supabase.from('properties').select('*');
    if (error) console.error('[GlobalState] Properties fetch error:', error);
    const rows = (data as PropertyDBRow[] | null) ?? [];
    setProperties(rows.map((row) => mapPropertyFromDB(row)));
    setLoadingProperties(false);
  }, []);

  useEffect(() => {
    void fetchProperties();

    const propSub = supabase
      .channel('properties_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        () => {
          void fetchProperties();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(propSub);
    };
  }, [fetchProperties]);

  // ── Site Settings listener ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchSettings = async (): Promise<void> => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'site')
        .single();
      setSiteSettings(sanitizeSiteSettings(data?.value));
    };
    void fetchSettings();

    const settingsSub = supabase
      .channel('settings_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: 'key=eq.site',
        },
        (payload) => {
          const nextRow = payload.new as { value?: unknown } | null | undefined;
          setSiteSettings(sanitizeSiteSettings(nextRow?.value));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(settingsSub);
    };
  }, []);

  // ── Wishlist toggle ────────────────────────────────────────────────────────
  const toggleWishlist = async (
    property: Pick<Property, 'id' | 'name' | 'location' | 'price'>
  ): Promise<boolean> => {
    if (!authUser) {
      toast.info('Sign in to save properties to your wishlist.');
      return false;
    }
    const exists = wishlist.find(
      (p) => p.property_id === property.id || p.propertyId === property.id
    );
    try {
      if (exists) {
        await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', authUser.id)
          .eq('property_id', property.id);
        toast.success('Removed from wishlist');
      } else {
        await supabase.from('wishlist').insert({
          user_id: authUser.id,
          property_id: property.id,
          property_name: property.name,
          location: property.location,
          price: property.price,
        });
        toast.success('Added to wishlist');
      }
      return true;
    } catch (err) {
      console.error(err);
      toast.error('Failed to update wishlist');
      return false;
    }
  };

  // ── Mark notifications read ────────────────────────────────────────────────
  const markNotificationsRead = async (): Promise<void> => {
    if (!authUser) return;
    try {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length === 0) return;
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    } catch (err) {
      console.error(err);
    }
  };

  const isLoggedIn = Boolean(authUser);
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  const isSuperAdmin = userProfile?.role === 'super_admin';

  // ── Admin unread inquiries badge counter (realtime + visibility sync) ───────
  const fetchUnreadCountAsync = useCallback(async (): Promise<number | null> => {
    try {
      const { count, error } = await supabase
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Unread');
      return error ? null : (count ?? 0);
    } catch (err) {
      console.error('[GlobalState] Unread inquiries count error:', err);
      return null;
    }
  }, []);

  const refreshUnreadInquiriesCount = useCallback(async (): Promise<void> => {
    if (!isAdmin) return;
    const nextCount = await fetchUnreadCountAsync();
    if (nextCount !== null) {
      setUnreadInquiriesCount(nextCount);
    }
  }, [isAdmin, fetchUnreadCountAsync]);

  useEffect(() => {
    if (!isAdmin) return;

    let active = true;
    const syncCount = (): void => {
      void fetchUnreadCountAsync().then((nextCount) => {
        if (active && nextCount !== null) {
          setUnreadInquiriesCount(nextCount);
        }
      });
    };

    syncCount();

    const inquiriesSub = supabase
      .channel('admin_inquiries_unread_badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inquiries' },
        () => {
          syncCount();
        }
      )
      .subscribe();

    const handleVisibilityOrFocus = (): void => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        syncCount();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      active = false;
      void supabase.removeChannel(inquiriesSub);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [isAdmin, fetchUnreadCountAsync]);

  const effectiveUnreadInquiriesCount = isAdmin ? unreadInquiriesCount : 0;

  return (
    <GlobalStateContext.Provider
      value={{
        authUser,
        userProfile,
        authLoading,
        isLoggedIn,
        isAdmin,
        isSuperAdmin,
        sessionExpiredReason,
        wishlist,
        toggleWishlist,
        notifications,
        markNotificationsRead,
        properties,
        loadingProperties,
        fetchProperties,
        adminUnsavedChanges,
        setAdminUnsavedChanges,
        bypassUnsavedGuard,
        setBypassUnsavedGuard,
        siteSettings,
        unreadInquiriesCount: effectiveUnreadInquiriesCount,
        refreshUnreadInquiriesCount,
      }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = (): GlobalStateContextValue => {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return ctx;
};
