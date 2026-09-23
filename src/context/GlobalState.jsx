import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, doc, onSnapshot, query, orderBy, limit, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
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

  useEffect(() => {
    let unsubProfile = () => { };
    let unsubWishlist = () => { };
    let unsubNotifications = () => { };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (user) {
        // Fetch user profile
        unsubProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.isBanned) {
              signOut(auth);
              toast.error("Your account has been suspended.");
              setUserProfile(null);
            } else {
              setUserProfile({ uid: user.uid, ...data });
            }
          } else {
            setUserProfile(null);
          }
          setAuthLoading(false);
        });

        // Fetch Wishlist
        unsubWishlist = onSnapshot(collection(db, `users/${user.uid}/wishlist`), (snap) => {
          setWishlist(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Fetch Notifications
        const q = query(collection(db, `users/${user.uid}/notifications`), orderBy('createdAt', 'desc'), limit(20));
        unsubNotifications = onSnapshot(q, (snap) => {
          setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

      } else {
        unsubProfile();
        unsubWishlist();
        unsubNotifications();
        setUserProfile(null);
        setWishlist([]);
        setNotifications([]);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubAuth();
      unsubProfile();
      unsubWishlist();
      unsubNotifications();
    };
  }, []);

  const toggleWishlist = async (property) => {
    if (!authUser) {
      toast.info("Sign in to save properties to your wishlist.");
      return false; // return false indicating not logged in
    }
    const exists = wishlist.find(p => p.propertyId === property.id || p.id === property.id);
    const ref = doc(db, `users/${authUser.uid}/wishlist`, property.id);
    try {
      if (exists) {
        await deleteDoc(ref);
        toast.success("Removed from wishlist");
      } else {
        await setDoc(ref, {
          propertyId: property.id,
          name: property.name,
          location: property.location,
          price: property.price,
          addedAt: new Date()
        });
        toast.success("Added to wishlist");
      }
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Failed to update wishlist");
      return false;
    }
  };

  const markNotificationsRead = async () => {
    if (!authUser) return;
    try {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, `users/${authUser.uid}/notifications`, n.id), { read: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'properties'), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProperties(data);
      setLoadingProperties(false);
    }, (error) => {
      console.error("Failed to fetch properties in GlobalState:", error);
      setLoadingProperties(false);
    });

    return () => unsub();
  }, []);

  const isLoggedIn = !!authUser;
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  const isSuperAdmin = userProfile?.role === 'super_admin';

  return (
    <GlobalStateContext.Provider value={{
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
      setBypassUnsavedGuard
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => useContext(GlobalStateContext);
