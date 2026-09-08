import 'server-only';

import { createHash, createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createSupabaseAdmin } from './supabase';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function clientAddress(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return request.headers.get('x-nf-client-connection-ip')?.trim()
    || request.headers.get('cf-connecting-ip')?.trim()
    || forwarded
    || 'unknown';
}

export function anonymousActorKey(request: NextRequest, discriminator = ''): string {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const input = `${clientAddress(request)}|${discriminator.trim().toLowerCase()}`;
  return secret
    ? createHmac('sha256', secret).update(input).digest('hex')
    : createHash('sha256').update(input).digest('hex');
}

export async function consumeRateLimit(
  scope: string,
  actorKey: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc('consume_server_rate_limit', {
    p_scope: scope,
    p_actor_key: actorKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`Rate-limit service unavailable: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Rate-limit service returned no result.');
  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? windowSeconds)),
  };
}

export async function clearRateLimit(scope: string, actorKey: string): Promise<void> {
  const { error } = await createSupabaseAdmin().rpc('clear_server_rate_limit', {
    p_scope: scope,
    p_actor_key: actorKey,
  });
  if (error) throw new Error(`Could not clear rate limit: ${error.message}`);
}
