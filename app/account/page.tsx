'use client';

import { ChangeEvent, useState } from 'react';
import { Camera, LockKeyhole, Save, ShieldAlert } from 'lucide-react';
import Image from 'next/image';
import Header from '@/components/Header';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';

export default function AccountPage() {
  const { profile, refreshProfile, updatePassword } = useAuth();
  const isRoot = profile?.role === 'SUPER_ADMIN';
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 2 * 1024 * 1024) return setMessage('Profile picture must be under 2 MB.');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${profile.id}/avatar-${Date.now()}.${extension}`;
    setSaving(true); setMessage(null);
    const { error } = await supabase.storage.from('profile-pictures').upload(path, file, { upsert: true });
    if (error) setMessage(error.message); else setAvatarUrl(supabase.storage.from('profile-pictures').getPublicUrl(path).data.publicUrl);
    setSaving(false);
  };

  const saveProfile = async () => {
    setSaving(true); setMessage(null);
    const { error } = await supabase.rpc('update_my_profile', { new_display_name: displayName, new_avatar_url: avatarUrl });
    setSaving(false);
    if (error) return setMessage(error.message);
    await refreshProfile(); setMessage('Profile updated.');
  };

  const savePassword = async () => {
    setSaving(true); setMessage(null);
    const result = await updatePassword(password);
    setSaving(false); setMessage(result.ok ? 'Password updated.' : result.error ?? 'Password update failed.');
    if (result.ok) setPassword('');
  };

  return <div className="min-h-dvh bg-konjo-charcoal pb-10">
    <Header title="Account Management" subtitle="profile & security" />
    <main className="mx-auto max-w-xl px-4 pt-5">
      {isRoot ? <section className="rounded-3xl border border-konjo-amber/25 bg-konjo-amber/10 p-5">
        <ShieldAlert className="text-konjo-amber" /><h1 className="mt-3 font-display text-lg font-bold text-konjo-cream">Root Owner account is locked</h1>
        <p className="mt-2 text-sm leading-relaxed text-konjo-cream/55">Profile picture, display name and password editing are disabled here to protect the immutable system owner identity. Emergency credential changes must be performed through Supabase Authentication by an authorized developer.</p>
      </section> : <div className="space-y-4">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h1 className="font-display text-base font-semibold text-konjo-cream">Profile</h1>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/20">{avatarUrl ? <Image src={avatarUrl} alt="Profile" fill sizes="80px" unoptimized className="object-cover"/> : <Camera className="text-konjo-cream/30"/>}</div>
            <label className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-konjo-cream/70"><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadAvatar}/>Choose picture</label>
          </div>
          <label className="mt-4 block text-xs text-konjo-cream/50">Display name<input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-konjo-cream outline-none focus:border-konjo-red/50"/></label>
          <button onClick={()=>void saveProfile()} disabled={saving} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-konjo-red font-semibold text-white disabled:opacity-50"><Save size={16}/>Save profile</button>
        </section>
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="font-display text-base font-semibold text-konjo-cream">Password</h2>
          <label className="mt-3 block text-xs text-konjo-cream/50">New password<input type="password" autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-konjo-cream outline-none focus:border-konjo-red/50"/></label>
          <p className="mt-2 text-[10px] text-konjo-cream/35">At least 10 characters with uppercase, lowercase and a number.</p>
          <button onClick={()=>void savePassword()} disabled={saving||!password} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 font-semibold text-konjo-cream disabled:opacity-40"><LockKeyhole size={16}/>Change password</button>
        </section>
      </div>}
      {message && <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-konjo-cream/70">{message}</p>}
    </main>
  </div>;
}
