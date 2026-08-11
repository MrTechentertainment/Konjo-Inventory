'use client';

import { useAuth } from '@/lib/AuthContext';
import LoginGate from './LoginGate';
import BrandLogo from './BrandLogo';

export default function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-konjo-charcoal">
        <div className="flex flex-col items-center gap-3"><BrandLogo size={52} /><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-konjo-red" /></div>
      </div>
    );
  }
  if (!session || !profile) return <LoginGate />;
  return <>{children}</>;
}
