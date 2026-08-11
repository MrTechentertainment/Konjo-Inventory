'use client';

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import type { UserProfile } from './types';
import { errorMessage } from './async';
import { usernameEmail } from './authz';

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
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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
  const latestProfileRequest = useRef(0);

  const loadProfile = useCallback(async (activeSession?: Session | null) => {
    const requestId = ++latestProfileRequest.current;
    try {
      const current = activeSession === undefined ? (await supabase.auth.getSession()).data.session : activeSession;
      if (!current) {
        if (requestId === latestProfileRequest.current) setProfile(null);
        return;
      }
      const { data, error } = await supabase.rpc('get_my_profile');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (requestId === latestProfileRequest.current) setProfile((row as UserProfile | undefined) ?? null);
    } catch (error) {
      if (requestId === latestProfileRequest.current) setProfile(null);
      throw error;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      await loadProfile(session);
    } catch {}
  }, [loadProfile, session]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const initialize = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        setSession(data.session);
        await loadProfile(data.session);
      } catch {
        if (mounted) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void initialize();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(true);
      window.setTimeout(() => {
        void loadProfile(nextSession).catch(() => undefined).finally(() => mounted && setLoading(false));
      }, 0);
    });
    return () => {
      mounted = false;
      latestProfileRequest.current += 1;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = useCallback(async (username: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Supabase environment variables are missing.' };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
      return error ? { ok: false, error: friendlyAuthError(error.message) } : { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error, 'Could not reach the sign-in service.') };
    }
  }, []);

  const register = useCallback(async (username: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return { ok: false, error: 'Supabase environment variables are missing.' };
    const clean = username.trim();
    if (!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(clean)) {
      return { ok: false, error: 'Use 3–32 letters, numbers, dots, dashes or underscores.' };
    }
    if (clean.toLowerCase() === 'natanim') return { ok: false, error: 'That username is reserved.' };
    const strong = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
    if (!strong) {
      return { ok: false, error: 'Use at least 12 characters with uppercase, lowercase, a number and a symbol.' };
    }
    try {
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
    } catch (error) {
      return { ok: false, error: errorMessage(error, 'Could not create the account.') };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setProfile(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, loading, configured: isSupabaseConfigured, login, register, logout, refreshProfile }),
    [session, profile, loading, login, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
