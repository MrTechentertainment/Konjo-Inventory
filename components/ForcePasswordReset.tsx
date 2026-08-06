'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import BrandLogo from './BrandLogo';

export default function ForcePasswordReset() {
  const { profile, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (password !== confirm) return setError('Passwords do not match.');
    setSaving(true); setError(null);
    const result = await updatePassword(password);
    setSaving(false);
    if (!result.ok) setError(result.error ?? 'Password update failed.');
  };

  return <div className="flex min-h-dvh items-center justify-center bg-konjo-charcoal p-5">
    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl">
      <div className="flex items-center gap-3"><BrandLogo size={48} /><div><p className="font-display font-semibold text-konjo-cream">Set a private password</p><p className="text-xs text-konjo-cream/45">{profile?.display_name}, your temporary password has expired.</p></div></div>
      <div className="mt-5 space-y-3">
        <label className="block text-xs text-konjo-cream/55">New password<input type="password" autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-konjo-cream outline-none focus:border-konjo-red/50" /></label>
        <label className="block text-xs text-konjo-cream/55">Confirm password<input type="password" autoComplete="new-password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-konjo-cream outline-none focus:border-konjo-red/50" /></label>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-konjo-cream/35">Minimum 10 characters, including uppercase, lowercase and a number.</p>
      {error && <p role="alert" className="mt-3 text-xs text-konjo-red">{error}</p>}
      <button onClick={()=>void submit()} disabled={saving} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-konjo-red font-semibold text-white disabled:opacity-50"><KeyRound size={17}/>{saving?'Updating…':'Save new password'}</button>
    </div>
  </div>;
}
