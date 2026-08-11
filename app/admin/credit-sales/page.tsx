'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OperationsLedger from '@/components/OperationsLedger';
import Header from '@/components/Header';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/lib/authz';

export default function CreditSalesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const authorized = isAdminProfile(profile);
  useEffect(() => { if (profile && !authorized) router.replace('/outlets'); }, [authorized, profile, router]);
  if (!authorized) return null;
  return <div className="min-h-dvh bg-konjo-charcoal pb-12"><Header title="Operations Records" subtitle="sales, orders, samples and inventory" /><main className="mx-auto max-w-4xl px-4 pt-6"><div className="mb-5"><h1 className="font-display text-xl font-bold text-konjo-cream">Fiscal operations ledger</h1><p className="mt-1 text-xs text-konjo-cream/45">Click any entry to correct missing outlet, date, status, notes or product quantities. Draft entries remain visible until completed.</p></div><OperationsLedger /></main></div>;
}
