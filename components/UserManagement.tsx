'use client';

import { Ban, CheckCircle2, Crown, Search, Shield, ShieldMinus, ShieldPlus, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { errorMessage, withTimeout } from '@/lib/async';
import { ROOT_OWNER_ID } from '@/lib/authz';
import { supabase } from '@/lib/supabaseClient';
import type { UserProfile } from '@/lib/types';

type UserAction = 'PROMOTE' | 'DEMOTE' | 'BAN' | 'UNBAN';

const ROLE_LABEL = { SUPER_ADMIN: 'Root Owner', ADMIN: 'Admin', BASIC: 'Field Sales' } as const;

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await withTimeout(
        async (signal) => await supabase.rpc('list_user_profiles').abortSignal(signal),
        'Loading users'
      );
      if (result.error) throw result.error;
      setUsers((result.data as UserProfile[]) ?? []);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return users;
    return users.filter((user) => `${user.username} ${ROLE_LABEL[user.role]}`.toLocaleLowerCase().includes(needle));
  }, [query, users]);

  const manageUser = async (user: UserProfile, action: UserAction) => {
    if (user.id === ROOT_OWNER_ID) return;
    if (action === 'BAN' && !window.confirm(`Ban ${user.username}? They will lose access until the Root Owner restores the account.`)) return;
    setWorkingId(user.id);
    setError(null);
    try {
      const result = await withTimeout(
        async (signal) => await supabase.rpc('root_manage_user', { target_user_id: user.id, action_name: action }).abortSignal(signal),
        `${action.toLocaleLowerCase()} user`
      );
      if (result.error) throw result.error;
      await loadUsers();
    } catch (caught) {
      setError(errorMessage(caught, 'The user change did not save.'));
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section>
      <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 focus-within:border-konjo-amber/35">
        <Search size={18} className="shrink-0 text-konjo-cream/35" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users or ranks" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-konjo-cream placeholder:text-konjo-cream/30 focus:outline-none" />
      </label>

      {error && <p className="mt-4 rounded-2xl border border-konjo-red/25 bg-konjo-red/10 p-4 text-xs leading-relaxed text-konjo-red">{error}</p>}
      {loading && <p className="py-10 text-center text-sm text-konjo-cream/40">Loading users…</p>}

      <div className="mt-4 space-y-3">
        {!loading && visibleUsers.map((user) => {
          const isRoot = user.id === ROOT_OWNER_ID;
          const busy = workingId === user.id;
          const Icon = isRoot ? Crown : user.role === 'ADMIN' ? Shield : UserRound;
          return (
            <article key={user.id} className={`rounded-3xl border p-4 ${user.is_banned ? 'border-konjo-red/30 bg-konjo-red/[0.06]' : isRoot ? 'border-konjo-amber/25 bg-konjo-amber/[0.055]' : 'border-white/10 bg-white/[0.035]'}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isRoot ? 'bg-konjo-amber/15 text-konjo-amber' : user.is_banned ? 'bg-konjo-red/15 text-konjo-red' : 'bg-white/[0.06] text-konjo-cream/55'}`}><Icon size={19} /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-sm font-semibold text-konjo-cream">{user.username}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-konjo-cream/55">{ROLE_LABEL[user.role]}</span>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${user.is_banned ? 'bg-konjo-red/15 text-konjo-red' : 'bg-konjo-green/15 text-konjo-green'}`}>{user.is_banned ? 'Banned' : 'Active'}</span>
                    {isRoot && <span className="rounded-full bg-konjo-amber/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-konjo-amber">Protected</span>}
                  </div>
                </div>
              </div>

              {isRoot ? (
                <p className="mt-4 rounded-xl border border-konjo-amber/15 bg-black/10 px-3 py-2 text-[10.5px] leading-relaxed text-konjo-cream/45">The Root Owner cannot be demoted or banned.</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button disabled={busy || user.is_banned} onClick={() => void manageUser(user, user.role === 'ADMIN' ? 'DEMOTE' : 'PROMOTE')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-konjo-cream/75 disabled:cursor-not-allowed disabled:opacity-35">
                    {user.role === 'ADMIN' ? <ShieldMinus size={16} /> : <ShieldPlus size={16} />}{user.role === 'ADMIN' ? 'Demote' : 'Promote'}
                  </button>
                  <button disabled={busy} onClick={() => void manageUser(user, user.is_banned ? 'UNBAN' : 'BAN')} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${user.is_banned ? 'border-konjo-green/25 bg-konjo-green/10 text-konjo-green' : 'border-konjo-red/25 bg-konjo-red/10 text-konjo-red'}`}>
                    {user.is_banned ? <CheckCircle2 size={16} /> : <Ban size={16} />}{busy ? 'Saving…' : user.is_banned ? 'Restore' : 'Ban'}
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {!loading && !visibleUsers.length && <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-konjo-cream/35">No matching users.</p>}
      </div>
    </section>
  );
}
