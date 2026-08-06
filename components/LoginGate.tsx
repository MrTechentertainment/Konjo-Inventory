'use client';

import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import BrandLogo from './BrandLogo';

export default function LoginGate() {
  const { login, register, configured } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter both username and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = mode === 'login' ? await login(username, password) : await register(username, password);
    setSubmitting(false);
    if (!result.ok) setError(result.error ?? 'Authentication failed.');
    else router.replace('/');
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-konjo-charcoal px-5 py-10">
      <div className="bg-mitmita-glow pointer-events-none absolute inset-0 opacity-90" />
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.055] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <BrandLogo size={56} />
          <div>
            <h1 className="font-display text-xl font-bold text-konjo-cream">KONJO IMS</h1>
            <p className="text-xs text-konjo-cream/50">Secure inventory operations</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-xl bg-black/20 p-1">
          {(['login', 'register'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => { setMode(item); setError(null); }}
              className={`rounded-lg py-2 text-xs font-semibold transition ${mode === item ? 'bg-konjo-red text-white' : 'text-konjo-cream/50'}`}
            >
              {item === 'login' ? 'Sign in' : 'Create field account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block">
            <span className="text-[11px] font-medium text-konjo-cream/55">Username</span>
            <span className="mt-1 flex h-12 items-center gap-2.5 rounded-xl border border-white/10 bg-black/15 px-3">
              <UserRound size={16} className="text-konjo-cream/35" />
              <input
                autoCapitalize="none"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-konjo-cream placeholder:text-konjo-cream/25 focus:outline-none"
                placeholder="Your username"
              />
            </span>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-konjo-cream/55">Password</span>
            <span className="mt-1 flex h-12 items-center gap-2.5 rounded-xl border border-white/10 bg-black/15 px-3">
              <LockKeyhole size={16} className="text-konjo-cream/35" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-konjo-cream placeholder:text-konjo-cream/25 focus:outline-none"
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Password'}
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Show or hide password" className="text-konjo-cream/40">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {!configured && <p className="rounded-xl border border-konjo-amber/30 bg-konjo-amber/10 p-3 text-xs text-konjo-amber">Add the Supabase URL and anon key to <code>.env.local</code>.</p>}
          {error && <p role="alert" className="rounded-xl border border-konjo-red/30 bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}

          <button disabled={submitting || !configured} className="h-12 w-full rounded-xl bg-gradient-to-br from-konjo-red to-konjo-red-deep font-display text-sm font-semibold text-white shadow-lg shadow-konjo-red/25 transition active:scale-[0.98] disabled:opacity-50">
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create basic account'}
          </button>
        </form>
        <p className="mt-4 text-center text-[10.5px] leading-relaxed text-konjo-cream/35">Field accounts begin with Basic access. Only the Root Owner can change roles.</p>
      </motion.section>
    </main>
  );
}
