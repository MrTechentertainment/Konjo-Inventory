'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/AdminDashboard';
import Header from '@/components/Header';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/lib/authz';

export default function AdminHomePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const authorized = isAdminProfile(profile);
  useEffect(() => {
    if (profile && !authorized) router.replace('/outlets');
  }, [authorized, profile, router]);
  if (!authorized) return null;
  return <div className="min-h-dvh bg-konjo-charcoal"><Header title="Admin Dashboard" subtitle="command center" /><AdminDashboard /></div>;
}
