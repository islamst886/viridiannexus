import React, { createContext, useContext, useState } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);

  const getFriendlyError = (error) => {
    switch (error.code) {
      case 'auth/email-already-in-use': return 'An account with this email already exists.';
      case 'auth/wrong-password': return 'Incorrect password. Please try again.';
      case 'auth/user-not-found': return 'No account found with this email.';
      case 'auth/too-many-requests': return 'Too many attempts. Please wait and try again.';
      case 'auth/network-request-failed': return 'Network error. Check your connection.';
      default: return 'An error occurred. Please try again.';
    }
  };

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential;
    } catch (error) {
      toast.error(getFriendlyError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password, name, phone) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const randomReferral = 'VN-' + Math.random().toString(36).substring(2, 8).toUpperCase();

      await setDoc(doc(db, 'users', user.uid), {
        displayName: name,
        email: email,
        phone: phone || '',
        role: 'user',
        isBanned: false,
        referralCode: randomReferral,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });

      await sendEmailVerification(user);
      return userCredential;
    } catch (error) {
      toast.error(getFriendlyError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      toast.success('You have been signed out.');
    } catch (error) {
      toast.error('Failed to sign out.');
      throw error;
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('A password reset link has been sent to your email.');
    } catch (error) {
      toast.error(getFriendlyError(error));
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      signIn,
      signUp,
      signOut,
      resetPassword,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
