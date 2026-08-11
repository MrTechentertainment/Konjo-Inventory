'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import PriceTaxManager from '@/components/PriceTaxManager';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile } from '@/lib/authz';

export default function PricingPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const authorized = isAdminProfile(profile);
  useEffect(() => { if (profile && !authorized) router.replace('/outlets'); }, [authorized, profile, router]);
  if (!authorized) return null;
  return <div className="min-h-dvh bg-konjo-charcoal pb-12"><Header title="Price & Taxes" subtitle="admin catalog controls" /><main className="mx-auto max-w-3xl px-4 pt-6"><div className="mb-5"><h1 className="font-display text-xl font-bold text-konjo-cream">Product pricing</h1><p className="mt-1 text-xs text-konjo-cream/45">Prices are in Ethiopian birr. Enter tax as a percentage, for example 15.</p></div><PriceTaxManager /></main></div>;
}
