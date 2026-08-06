import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// A single shared client for the whole app. The anon key is meant to be
// public — it's safe to ship in client-side JS because every table it can
// touch is locked down with Row Level Security (see sql/schema.sql).
export const supabase = createClient(
  supabaseUrl ?? 'https://configuration-required.supabase.co',
  supabaseAnonKey ?? 'configuration-required',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    },
  }
);
