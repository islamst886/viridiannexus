import React, { createContext, useContext, useState } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);

  const getFriendlyError = (error) => {
    if (!error?.message) return 'An error occurred. Please try again.';
    const msg = error.message.toLowerCase();
    if (msg.includes('email already registered') || msg.includes('user already registered'))
      return 'An account with this email already exists.';
    if (msg.includes('invalid login credentials') || msg.includes('invalid email or password'))
      return 'Invalid email or password. Please try again.';
    if (msg.includes('email not confirmed'))
      return 'Please verify your email before signing in.';
    if (msg.includes('too many requests'))
      return 'Too many attempts. Please wait and try again.';
    if (msg.includes('network'))
      return 'Network error. Check your connection.';
    if (msg.includes('requires recent'))
      return 'This action requires recent authentication. Please sign out and sign back in.';
    return error.message || 'An error occurred. Please try again.';
  };

  // ── Sign In ────────────────────────────────────────────────────────────────
  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (error) {
      toast.error(getFriendlyError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up ────────────────────────────────────────────────────────────────
  // Profile row is auto-created by the DB trigger handle_new_user — no manual setDoc needed.
  const signUp = async (email, password, name, phone) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name,
            phone: phone || '',
          },
        },
      });
      if (error) throw error;
      toast.info('A verification email has been sent. Please check your inbox.');
      return data;
    } catch (error) {
      toast.error(getFriendlyError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Out ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('You have been signed out.');
    } catch (error) {
      toast.error('Failed to sign out.');
      throw error;
    }
  };

  // ── Reset Password ─────────────────────────────────────────────────────────
  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });
      if (error) throw error;
      toast.success('A password reset link has been sent to your email.');
    } catch (error) {
      toast.error(getFriendlyError(error));
      throw error;
    }
  };

  // ── Resend Verification Email ──────────────────────────────────────────────
  const resendVerificationEmail = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user.');
      if (user.email_confirmed_at) {
        toast.info('Your email is already verified.');
        return;
      }
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });
      if (error) throw error;
      toast.success('Verification email sent! Please check your inbox.');
    } catch (err) {
      if (err.message?.toLowerCase().includes('too many')) {
        toast.warning('Too many verification requests. Please wait a few minutes.');
      } else {
        toast.error('Failed to send verification email.');
      }
    }
  };

  // ── Update Profile ─────────────────────────────────────────────────────────
  const updateUserProfileData = async (data) => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('No authenticated user found.');

      // 1. Update Supabase Auth metadata (displayName)
      const authMeta = {};
      if (data.displayName !== undefined) authMeta.display_name = data.displayName;
      if (Object.keys(authMeta).length > 0) {
        const { error: metaErr } = await supabase.auth.updateUser({ data: authMeta });
        if (metaErr) throw metaErr;
      }

      // 2. Handle email change (requires verification)
      const docUpdates = { ...data };
      if (data.email && data.email.trim().toLowerCase() !== user.email?.toLowerCase()) {
        const { error: emailErr } = await supabase.auth.updateUser({
          email: data.email.trim(),
        });
        if (emailErr) {
          toast.warning(
            'Email change requires verification. Check your new email inbox.'
          );
          delete docUpdates.email;
        } else {
          toast.info('A verification link has been sent to your new email.');
        }
      }

      // 3. Build profiles table update (snake_case)
      const profileUpdate = { updated_at: new Date().toISOString() };
      if (docUpdates.displayName !== undefined) profileUpdate.display_name = docUpdates.displayName;
      if (docUpdates.email !== undefined) profileUpdate.email = docUpdates.email;
      if (docUpdates.phone !== undefined) profileUpdate.phone = docUpdates.phone;
      if (docUpdates.avatar !== undefined) profileUpdate.avatar = docUpdates.avatar;

      const { error: profileErr } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      toast.success('Profile updated successfully!');
      return true;
    } catch (err) {
      console.error('Profile update error:', err);
      toast.error(getFriendlyError(err) || 'Failed to update profile.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendVerificationEmail,
        updateUserProfileData,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
