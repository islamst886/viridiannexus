import React, { createContext, useState, useContext } from 'react';

const GlobalStateContext = createContext();

export const GlobalStateProvider = ({ children }) => {
  // Mock User State
  const [user, setUser] = useState({
    name: 'John Doe',
    email: 'john@example.com',
    walletBalance: 250000,
    referralCode: 'VIRIDIAN-JD88',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John'
  });

  // Mock Wishlist State
  const [wishlist, setWishlist] = useState([
    { id: '1', name: 'The Sapphire Penthouse', location: 'Gulshan 2', price: '৳ 5,00,00,000' }
  ]);

  // Mock Notifications State
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Your bidding for "The Sapphire Penthouse" is winning!', read: false },
    { id: 2, text: 'New project "Emerald Heights" just launched.', read: true }
  ]);

  const toggleWishlist = (property) => {
    setWishlist(prev => {
      const exists = prev.find(p => p.id === property.id);
      if (exists) {
        return prev.filter(p => p.id !== property.id);
      }
      return [...prev, property];
    });
  };

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <GlobalStateContext.Provider value={{
      user,
      wishlist,
      toggleWishlist,
      notifications,
      markNotificationsRead
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => useContext(GlobalStateContext);
