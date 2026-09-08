import { NextRequest, NextResponse } from 'next/server';
import { usernameEmail } from '@/lib/authz';
import { anonymousActorKey, clearRateLimit, consumeRateLimit } from '@/lib/server/rateLimit';
import { createServerAuthClient } from '@/lib/server/supabase';

export const runtime = 'nodejs';

type AuthAction = 'login' | 'register';

function jsonError(message: string, status: number, retryAfter?: number) {
  const response = NextResponse.json({ error: message }, { status });
  if (retryAfter) response.headers.set('Retry-After', String(retryAfter));
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: AuthAction; username?: string; password?: string };
    const action = body.action;
    const username = body.username?.trim() ?? '';
    const password = body.password ?? '';
    if (action !== 'login' && action !== 'register') return jsonError('Invalid authentication action.', 400);
    if (!username || !password) return jsonError('Enter both username and password.', 400);

    const isLogin = action === 'login';
    const scope = isLogin ? 'AUTH_LOGIN' : 'AUTH_REGISTER';
    const actorKey = anonymousActorKey(request, isLogin ? username : 'signup');
    const rate = await consumeRateLimit(scope, actorKey, 5, isLogin ? 15 * 60 : 60 * 60);
    if (!rate.allowed) {
      const minutes = Math.max(1, Math.ceil(rate.retryAfterSeconds / 60));
      return jsonError(`Too many ${isLogin ? 'sign-in attempts' : 'account registrations'}. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`, 429, rate.retryAfterSeconds);
    }

    const supabase = createServerAuthClient();
    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: usernameEmail(username), password });
      if (error) return jsonError(error.message, error.status || 401);
      await clearRateLimit(scope, actorKey);
      return NextResponse.json({ session: data.session });
    }

    if (!/^[A-Za-z][A-Za-z0-9._-]{2,31}$/.test(username)) {
      return jsonError('Use 3–32 letters, numbers, dots, dashes or underscores.', 400);
    }
    if (username.toLowerCase() === 'natanim') return jsonError('That username is reserved.', 400);
    if (password.length < 6) return jsonError('Password must contain at least 6 characters.', 400);

    const { data, error } = await supabase.auth.signUp({
      email: usernameEmail(username),
      password,
      options: { data: { username } },
    });
    if (error) return jsonError(error.message, error.status || 400);
    return NextResponse.json({ session: data.session, accountCreated: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication service unavailable.';
    return jsonError(message, 503);
  }
}
