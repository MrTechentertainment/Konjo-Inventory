import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function temporaryPassword() { return `Kj!${randomBytes(10).toString('base64url')}7a`; }

export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: 'Server credential is not configured.' }, { status: 503 });
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  const { data: requester } = await admin.from('users_profiles').select('username,role').eq('id', user.id).single();
  if (requester?.role !== 'SUPER_ADMIN' || requester.username.toLowerCase() !== 'natanim') return NextResponse.json({ error: 'Root Owner access required.' }, { status: 403 });
  const { data: target } = await admin.from('users_profiles').select('username').eq('id', params.userId).single();
  if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  if (target.username.toLowerCase() === 'natanim') return NextResponse.json({ error: 'Root Owner credentials cannot be changed here.' }, { status: 403 });
  const password = temporaryPassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(params.userId, { password });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  const { error: profileError } = await admin.from('users_profiles').update({ must_reset_password: true }).eq('id', params.userId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  return NextResponse.json({ temporary_password: password }, { headers: { 'Cache-Control': 'no-store' } });
}
