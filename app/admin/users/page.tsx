'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import UserManagement from '@/components/UserManagement';
import { useAuth } from '@/lib/AuthContext';
import { isRootProfile } from '@/lib/authz';

export default function RootUserManagementPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const authorized = isRootProfile(profile);

  useEffect(() => {
    if (profile && !authorized) router.replace('/admin');
  }, [authorized, profile, router]);

  if (!authorized) return null;
  return (
    <div className="min-h-dvh bg-konjo-charcoal pb-12">
      <Header title="User Management" subtitle="Root Owner only" />
      <main className="mx-auto max-w-3xl px-4 pt-6">
        <div className="mb-5">
          <h1 className="font-display text-xl font-bold text-konjo-cream">Users and access</h1>
          <p className="mt-1 text-xs leading-relaxed text-konjo-cream/45">Review every account and rank. Promote or demote staff, or ban an account from accessing operational data.</p>
        </div>
        <UserManagement />
      </main>
    </div>
  );
}
