import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabase';
import { mapPropertyFromDB, mapProfileFromDB } from '../utils/mappers';
import { toast } from 'react-toastify';

const GlobalStateContext = createContext();

export const GlobalStateProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [wishlist, setWishlist] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [adminUnsavedChanges, setAdminUnsavedChanges] = useState(false);
  const [bypassUnsavedGuard, setBypassUnsavedGuard] = useState(false);
  const [siteSettings, setSiteSettings] = useState(null);

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      if (!session?.user) setAuthLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      
      setAuthUser((prevUser) => {
        // If a user logs in, set loading to true while we fetch their profile
        if (user && !prevUser) {
          setAuthLoading(true);
        }
        return user;
      });

      if (!user) {
        setUserProfile(null);
        setWishlist([]);
        setNotifications([]);
        setAuthLoading(false);
      }
    });

    return () => authSub.unsubscribe();
  }, []);

  // ── Profile listener ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('[GlobalState] Profile fetch error:', error);
        // If the profile is completely missing (deleted from auth/profiles), sign out
        if (error.code === 'PGRST116') {
           await supabase.auth.signOut();
           toast.error('Your session has expired or account was removed.');
           setUserProfile(null);
        }
        setAuthLoading(false);
        return;
      }
      if (data?.is_banned) {
        await supabase.auth.signOut();
        toast.error('Your account has been suspended.');
        setUserProfile(null);
      } else {
        setUserProfile(mapProfileFromDB(data));
      }
      setAuthLoading(false);
    };

    fetchProfile();

    // Realtime profile subscription
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
          const data = payload.new;
          if (data?.is_banned) {
            supabase.auth.signOut();
            toast.error('Your account has been suspended.');
            setUserProfile(null);
          } else {
            setUserProfile(mapProfileFromDB(data));
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(profileSub);
  }, [authUser?.id]);

  // ── Wishlist listener ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) { setWishlist([]); return; }

    const fetchWishlist = async () => {
      const { data } = await supabase
        .from('wishlist')
        .select('*')
        .eq('user_id', authUser.id);
      setWishlist(data || []);
    };
    fetchWishlist();

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
        fetchWishlist
      )
      .subscribe();

    return () => supabase.removeChannel(wishlistSub);
  }, [authUser?.id]);

  // ── Notifications listener ─────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) { setNotifications([]); return; }

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications(data || []);
    };
    fetchNotifications();

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
        fetchNotifications
      )
      .subscribe();

    return () => supabase.removeChannel(notifSub);
  }, [authUser?.id]);

  // ── Properties listener (realtime) ────────────────────────────────────────
  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase.from('properties').select('*');
      if (error) console.error('[GlobalState] Properties fetch error:', error);
      setProperties((data || []).map(mapPropertyFromDB));
      setLoadingProperties(false);
    };
    fetchProperties();

    const propSub = supabase
      .channel('properties_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        fetchProperties
      )
      .subscribe();

    return () => supabase.removeChannel(propSub);
  }, []);

  // ── Site Settings listener ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'site')
        .single();
      setSiteSettings(
        data?.value || { facebookUrl: '', youtubeUrl: '', linkedinUrl: '', whatsappNumber: '' }
      );
    };
    fetchSettings();

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
        (payload) => setSiteSettings(payload.new?.value || {})
      )
      .subscribe();

    return () => supabase.removeChannel(settingsSub);
  }, []);

  // ── Wishlist toggle ────────────────────────────────────────────────────────
  const toggleWishlist = async (property) => {
    if (!authUser) {
      toast.info('Sign in to save properties to your wishlist.');
      return false;
    }
    // Support both wishlist shapes (property_id from DB or propertyId legacy)
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
  const markNotificationsRead = async () => {
    if (!authUser) return;
    try {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length === 0) return;
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
    } catch (err) {
      console.error(err);
    }
  };

  const isLoggedIn = !!authUser;
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  const isSuperAdmin = userProfile?.role === 'super_admin';

  return (
    <GlobalStateContext.Provider
      value={{
        authUser,
        userProfile,
        authLoading,
        isLoggedIn,
        isAdmin,
        isSuperAdmin,
        wishlist,
        toggleWishlist,
        notifications,
        markNotificationsRead,
        properties,
        loadingProperties,
        adminUnsavedChanges,
        setAdminUnsavedChanges,
        bypassUnsavedGuard,
        setBypassUnsavedGuard,
        siteSettings,
      }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => useContext(GlobalStateContext);
