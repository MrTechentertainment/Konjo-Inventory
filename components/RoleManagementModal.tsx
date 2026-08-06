'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Shield, UserRound, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { UserProfile, UserRole } from '@/lib/types';
// Define the event constant locally instead of importing a missing member
const ROLE_MODAL_EVENT = 'open-role-management-modal';

function RoleManagementModal() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const authorized = profile?.username.toLowerCase() === 'natanim' && profile.role === 'SUPER_ADMIN';

  const loadUsers = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    const { data, error: queryError } = await supabase.rpc('list_user_profiles');
    setLoading(false);
    if (queryError) setError(queryError.message);
    else setUsers((data as UserProfile[]) ?? []);
  }, [authorized]);

  useEffect(() => {
    const show = () => { if (authorized) { setOpen(true); void loadUsers(); } };
    window.addEventListener(ROLE_MODAL_EVENT, show);
    return () => window.removeEventListener(ROLE_MODAL_EVENT, show);
  }, [authorized, loadUsers]);

  const changeRole = async (user: UserProfile, role: Extract<UserRole, 'ADMIN' | 'BASIC'>) => {
    if (user.username.toLowerCase() === 'natanim') return;
    setWorkingId(user.id);
    setError(null);
    const { error: mutationError } = await supabase.rpc('set_user_role', { target_user_id: user.id, new_role: role });
    setWorkingId(null);
    if (mutationError) setError(mutationError.message);
    else await loadUsers();
  };

  if (!authorized) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 sm:items-center">
          <motion.section initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'tween', duration: 0.2 }} onClick={(event) => event.stopPropagation()} className="max-h-[88dvh] w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between border-b border-white/10 p-4">
              <div><p className="flex items-center gap-2 font-display font-semibold text-konjo-cream"><Crown size={17} className="text-konjo-amber" />User Role Management</p><p className="mt-1 text-[11px] text-konjo-cream/40">Root Owner access only</p></div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-konjo-cream/60"><X size={16} /></button>
            </div>
            <div className="max-h-[65dvh] space-y-2 overflow-y-auto p-4">
              {loading && <p className="py-8 text-center text-xs text-konjo-cream/40">Loading users…</p>}
              {error && <p className="rounded-xl bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}
              {users.map((user) => {
                const isProtected = user.username.toLowerCase() === 'natanim';
                return (
                  <div key={user.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isProtected ? 'bg-konjo-amber/15 text-konjo-amber' : 'bg-white/5 text-konjo-cream/50'}`}>{isProtected ? <Crown size={16} /> : user.role === 'ADMIN' ? <Shield size={16} /> : <UserRound size={16} />}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-konjo-cream">{user.username}</p><p className="text-[10px] text-konjo-cream/35">{isProtected ? 'Immutable Root Owner' : user.role}</p></div>
                    {isProtected ? <span className="rounded-full bg-konjo-amber/10 px-2 py-1 text-[10px] font-bold text-konjo-amber">LOCKED</span> : (
                      <button disabled={workingId === user.id} onClick={() => void changeRole(user, user.role === 'ADMIN' ? 'BASIC' : 'ADMIN')} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-konjo-cream/70 disabled:opacity-40">{user.role === 'ADMIN' ? 'Demote' : 'Promote'}</button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(RoleManagementModal);
