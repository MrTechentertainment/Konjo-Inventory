'use client';

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import type { UserProfile } from './types';

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  login: (username: string, password: string) => Promise<AuthResult>;
  register: (username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updatePassword: (password: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROOT_OWNER_EMAIL = 'natanim@konjo.com';

function usernameEmail(username: string): string {
  const normalizedUsername = username.trim().toLowerCase();

  if (normalizedUsername === 'natanim') {
    return ROOT_OWNER_EMAIL;
  }

  return `${normalizedUsername}@konjo.internal`;

}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Incorrect username or password.';
  if (/email not confirmed/i.test(message)) return 'Account confirmation is enabled in Supabase. Disable email confirmation for this username-only setup.';
  if (/user already registered/i.test(message)) return 'That username is already registered.';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (activeSession?: Session | null) => {
    const current = activeSession ?? (await supabase.auth.getSession()).data.session;
    if (!current) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase.rpc('get_my_profile');
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    setProfile((row as UserProfile | undefined) ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      await loadProfile(session);
    } catch {
      setProfile(null);
    }
  }, [loadProfile, session]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let mounted = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      try {
        await loadProfile(data.session);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(true);
      window.setTimeout(() => {
        void loadProfile(nextSession).finally(() => mounted && setLoading(false));
      }, 0);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = useCallback(async (username: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Supabase environment variables are missing.' };
    const { error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
    return error ? { ok: false, error: friendlyAuthError(error.message) } : { ok: true };
  }, []);

  const register = useCallback(async (username: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Supabase environment variables are missing.' };
    const clean = username.trim();
    if (!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(clean)) {
      return { ok: false, error: 'Use 3–32 letters, numbers, dots, dashes or underscores.' };
    }
    if (clean.toLowerCase() === 'natanim') return { ok: false, error: 'That username is reserved.' };
    if (password.length < 6) return { ok: false, error: 'Password must contain at least 6 characters.' };
    const { data, error } = await supabase.auth.signUp({
      email: usernameEmail(clean),
      password,
      options: { data: { username: clean } },
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    if (!data.session) {
      return { ok: false, error: 'Account created, but email confirmation is enabled. Disable it in Supabase Auth settings, then sign in.' };
    }
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return { ok: false, error: 'Use at least 10 characters with uppercase, lowercase and a number.' };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    const { error: profileError } = await supabase.rpc('complete_password_reset');
    if (profileError) return { ok: false, error: profileError.message };
    await loadProfile(session);
    return { ok: true };
  }, [loadProfile, session]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, loading, configured: isSupabaseConfigured, login, register, logout, updatePassword, refreshProfile }),
    [session, profile, loading, login, register, logout, updatePassword, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
