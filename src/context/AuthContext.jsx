import React, { createContext, useContext, useState } from 'react';
import { auth, db } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updateEmail,
  verifyBeforeUpdateEmail
} from 'firebase/auth';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);

  const getFriendlyError = (error) => {
    if (!error?.code) return error?.message || 'An error occurred. Please try again.';
    switch (error.code) {
      case 'auth/email-already-in-use': return 'An account with this email already exists.';
      case 'auth/wrong-password': return 'Incorrect password. Please try again.';
      case 'auth/user-not-found': return 'No account found with this email.';
      case 'auth/too-many-requests': return 'Too many attempts. Please wait and try again.';
      case 'auth/network-request-failed': return 'Network error. Check your connection.';
      case 'auth/requires-recent-login': return 'This action requires recent authentication. Please log out and sign in again.';
      default: return error.message || 'An error occurred. Please try again.';
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

  const resendVerificationEmail = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user.");
      if (user.emailVerified) {
        toast.info("Your email is already verified.");
        return;
      }
      await sendEmailVerification(user);
      toast.success("Verification email sent! Please check your inbox.");
    } catch (err) {
      if (err.code === 'auth/too-many-requests') {
        toast.warning("Too many verification requests. Please wait a few minutes.");
      } else {
        toast.error("Failed to send verification email.");
      }
    }
  };

  const updateUserProfileData = async (data) => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user found.");

      // 1. Update Firebase Auth Profile (displayName, photoURL)
      const authUpdates = {};
      if (data.displayName !== undefined) authUpdates.displayName = data.displayName;
      if (data.avatar !== undefined) authUpdates.photoURL = data.avatar;

      if (Object.keys(authUpdates).length > 0) {
        await updateProfile(user, authUpdates);
      }

      // 2. If email change was requested and differs from current auth email
      const docUpdates = { ...data };
      if (data.email && data.email.trim().toLowerCase() !== user.email?.toLowerCase()) {
        try {
          if (typeof verifyBeforeUpdateEmail === 'function') {
            await verifyBeforeUpdateEmail(user, data.email.trim());
            toast.info("A verification link has been sent to your new email. Please verify it to complete the update.");
          } else if (typeof updateEmail === 'function') {
            await updateEmail(user, data.email.trim());
            toast.success("Login email updated.");
          }
        } catch (emailErr) {
          console.warn("Auth email update issue:", emailErr);
          if (emailErr.code === 'auth/requires-recent-login') {
            toast.warning("For security, changing your email requires recent authentication. Please sign out and sign back in.");
          } else if (emailErr.code === 'auth/email-already-in-use') {
            toast.error("This email is already in use by another account.");
          } else {
            toast.error(getFriendlyError(emailErr));
          }
          // Don't overwrite the Firestore email if Auth rejected the change
          delete docUpdates.email;
        }
      }

      // 3. Update Firestore Document
      docUpdates.updatedAt = serverTimestamp();
      await updateDoc(doc(db, 'users', user.uid), docUpdates);

      toast.success("Profile updated successfully!");
      return true;
    } catch (err) {
      console.error("Profile update error:", err);
      toast.error(getFriendlyError(err) || "Failed to update profile.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      signIn,
      signUp,
      signOut,
      resetPassword,
      resendVerificationEmail,
      updateUserProfileData,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
