import { NextRequest, NextResponse } from 'next/server';
import { ROOT_OWNER_ID, ROOT_OWNER_USERNAME } from '@/lib/authz';
import { consumeRateLimit } from '@/lib/server/rateLimit';
import { createServerAuthClient, createSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

type UserAction = 'PROMOTE' | 'DEMOTE' | 'BAN' | 'UNBAN' | 'RESET_PASSWORD';
const ACTIONS = new Set<UserAction>(['PROMOTE', 'DEMOTE', 'BAN', 'UNBAN', 'RESET_PASSWORD']);

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const admin = createSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const actorId = authData.user?.id;
    if (authError || !actorId) return NextResponse.json({ error: 'Your session is invalid or expired.' }, { status: 401 });

    const { data: actor } = await admin.from('users_profiles').select('id,username,role,is_banned').eq('id', actorId).maybeSingle();
    const isRoot = actor?.id === ROOT_OWNER_ID
      && actor.username?.trim().toLowerCase() === ROOT_OWNER_USERNAME
      && actor.role === 'SUPER_ADMIN'
      && !actor.is_banned;
    if (!isRoot) return NextResponse.json({ error: 'Root Owner access required.' }, { status: 403 });

    const { userId } = await context.params;
    const body = await request.json() as { action?: UserAction };
    const action = body.action;
    if (!action || !ACTIONS.has(action)) return NextResponse.json({ error: 'Invalid user-management action.' }, { status: 400 });
    if (userId === ROOT_OWNER_ID) return NextResponse.json({ error: 'The Root Owner account is protected.' }, { status: 400 });

    const isReset = action === 'RESET_PASSWORD';
    const rate = await consumeRateLimit(
      isReset ? 'ROOT_PASSWORD_RESET' : 'ROOT_USER_ADMIN',
      isReset ? `${actorId}:${userId}` : actorId,
      isReset ? 3 : 20,
      60 * 60
    );
    if (!rate.allowed) {
      const response = NextResponse.json({ error: isReset ? 'This password was reset too many times. Try again later.' : 'Too many account-management changes. Try again later.' }, { status: 429 });
      response.headers.set('Retry-After', String(rate.retryAfterSeconds));
      return response;
    }

    const { data: target, error: targetError } = await admin.from('users_profiles').select('id,username,role').eq('id', userId).maybeSingle();
    if (targetError || !target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    if (target.role === 'SUPER_ADMIN' || target.username?.trim().toLowerCase() === ROOT_OWNER_USERNAME) {
      return NextResponse.json({ error: 'The Root Owner account is protected.' }, { status: 400 });
    }

    if (action === 'RESET_PASSWORD') {
      const { error } = await admin.auth.admin.updateUserById(userId, { password: '123456' });
      if (error) throw error;
      await admin.from('security_audit_events').insert({
        actor_id: actorId,
        target_user_id: userId,
        action: 'RESET_PASSWORD',
        details: { reset_to_temporary_default: true },
      });
      return NextResponse.json({ ok: true, message: `${target.username}'s password is now 123456.` });
    }

    const userClient = createServerAuthClient(token);
    const { error } = await userClient.rpc('root_manage_user', { target_user_id: userId, action_name: action });
    if (error) throw error;
    await admin.from('security_audit_events').insert({
      actor_id: actorId,
      target_user_id: userId,
      action,
      details: {},
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The user change failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
