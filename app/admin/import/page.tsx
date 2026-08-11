'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CsvImportTool from '@/components/CsvImportTool';
import Header from '@/components/Header';
import { useAuth } from '@/lib/AuthContext';
import { isRootProfile } from '@/lib/authz';

export default function RootImportPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const authorized = isRootProfile(profile);
  useEffect(() => { if (profile && !authorized) router.replace('/admin'); }, [authorized, profile, router]);
  if (!authorized) return null;
  return <div className="min-h-dvh bg-konjo-charcoal pb-12"><Header title="Data Import" subtitle="Root Owner only" /><main className="mx-auto max-w-3xl px-4 pt-6"><div className="mb-5"><h1 className="font-display text-xl font-bold text-konjo-cream">Import inventory or credit sales</h1><p className="mt-1 text-xs text-konjo-cream/45">Upload CSV, XLSX, or a text-based PDF. Review recognized and draft rows before the protected database transaction runs.</p></div><CsvImportTool /></main></div>;
}
