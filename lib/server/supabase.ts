import 'server-only';

import { createClient } from '@supabase/supabase-js';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function createServerAuthClient(accessToken?: string) {
  const url = requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = requiredEnvironment('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

export function createSupabaseAdmin() {
  return createClient(
    requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}
