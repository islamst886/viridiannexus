import React, { createContext, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { clearCachedAccessToken, supabase } from '../supabase';
import {
  beginAuthTransition,
  broadcastSessionLogout,
  clearAuthTransition,
  syncSessionMetaOnAuth,
} from '../utils/sessionManager';
import { normalizeExternalUrl } from '../utils/urlHelpers';

export interface ProfileUpdatePayload {
  displayName?: string;
  email?: string;
  phone?: string;
  emergencyPhone?: string;
  nidType?: string;
  nid?: string;
  address?: string;
  avatar?: string;
}

export interface AuthContextValue {
  signIn: (email: string, password: string) => Promise<unknown>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  updateUserProfileData: (data: ProfileUpdatePayload) => Promise<boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);

  const getFriendlyError = (error: unknown): string => {
    const message =
      error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : '';
    if (!message) return 'An error occurred. Please try again.';

    const msg = message.toLowerCase();
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
    return message;
  };

  // ── Sign In ────────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string): Promise<unknown> => {
    setLoading(true);
    beginAuthTransition();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        clearAuthTransition();
        throw error;
      }
      syncSessionMetaOnAuth({ session: data.session, isExplicitLogin: true });
      return data;
    } catch (error) {
      clearAuthTransition();
      toast.error(getFriendlyError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up ────────────────────────────────────────────────────────────────
  // Profile row is auto-created by the DB trigger handle_new_user — no manual insert needed.
  const signUp = async (
    email: string,
    password: string,
    name: string,
    phone = ''
  ): Promise<unknown> => {
    setLoading(true);
    beginAuthTransition();
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
      if (error) {
        clearAuthTransition();
        throw error;
      }
      if (data.session) {
        syncSessionMetaOnAuth({ session: data.session, isExplicitLogin: true });
      } else {
        clearAuthTransition();
      }
      toast.info('A verification email has been sent. Please check your inbox.');
      return data;
    } catch (error) {
      clearAuthTransition();
      toast.error(getFriendlyError(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Out ───────────────────────────────────────────────────────────────
  const signOut = async (): Promise<void> => {
    clearAuthTransition();
    clearCachedAccessToken();
    broadcastSessionLogout('manual');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        await supabase.auth.signOut({ scope: 'local' });
      }
      toast.success('You have been signed out.');
    } catch (error) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      toast.error('Failed to sign out.');
      throw error;
    }
  };

  // ── Reset Password ─────────────────────────────────────────────────────────
  const resetPassword = async (email: string): Promise<void> => {
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
  const resendVerificationEmail = async (): Promise<void> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error('No authenticated user.');
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
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof err.message === 'string'
          ? err.message
          : '';
      if (msg.toLowerCase().includes('too many')) {
        toast.warning('Too many verification requests. Please wait a few minutes.');
      } else {
        toast.error('Failed to send verification email.');
      }
    }
  };

  // ── Update Profile ─────────────────────────────────────────────────────────
  const updateUserProfileData = async (data: ProfileUpdatePayload): Promise<boolean> => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('No authenticated user found.');

      const authMeta: { display_name?: string } = {};
      if (data.displayName !== undefined) authMeta.display_name = data.displayName;
      if (Object.keys(authMeta).length > 0) {
        const { error: metaErr } = await supabase.auth.updateUser({ data: authMeta });
        if (metaErr) throw metaErr;
      }

      const docUpdates: ProfileUpdatePayload = { ...data };
      if (data.email && data.email.trim().toLowerCase() !== user.email?.toLowerCase()) {
        const { error: emailErr } = await supabase.auth.updateUser({
          email: data.email.trim(),
        });
        if (emailErr) {
          toast.warning('Email change requires verification. Check your new email inbox.');
          delete docUpdates.email;
        } else {
          toast.info('A verification link has been sent to your new email.');
        }
      }

      const profileUpdate: {
        updated_at: string;
        display_name?: string;
        email?: string;
        phone?: string;
        emergency_phone?: string;
        nid_type?: string;
        nid?: string;
        address?: string;
        avatar?: string;
      } = { updated_at: new Date().toISOString() };

      if (docUpdates.displayName !== undefined) profileUpdate.display_name = docUpdates.displayName;
      if (docUpdates.email !== undefined) profileUpdate.email = docUpdates.email;
      if (docUpdates.phone !== undefined) profileUpdate.phone = docUpdates.phone;
      if (docUpdates.emergencyPhone !== undefined) {
        profileUpdate.emergency_phone = docUpdates.emergencyPhone;
      }
      if (docUpdates.nidType !== undefined) profileUpdate.nid_type = docUpdates.nidType;
      if (docUpdates.nid !== undefined) profileUpdate.nid = docUpdates.nid;
      if (docUpdates.address !== undefined) profileUpdate.address = docUpdates.address;
      if (docUpdates.avatar !== undefined) {
        const trimmedAvatar = docUpdates.avatar.trim();
        if (trimmedAvatar) {
          const safeAvatar = normalizeExternalUrl(trimmedAvatar);
          if (!safeAvatar) {
            throw new Error('Invalid avatar URL. Please use a valid http(s) URL.');
          }
          profileUpdate.avatar = safeAvatar;
        } else {
          profileUpdate.avatar = '';
        }
      }

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

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
