'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/lib/authz';

export default function RoleLandingPage() {
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!profile) return;
    router.replace(isAdminProfile(profile) ? '/admin' : '/outlets');
  }, [profile, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-konjo-charcoal">
      <div className="flex flex-col items-center gap-3">
        <BrandLogo size={52} />
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" />
        <p className="text-xs text-konjo-cream/45">Opening your workspace…</p>
      </div>
    </div>
  );
}
