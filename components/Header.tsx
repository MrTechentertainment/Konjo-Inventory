'use client';

import dynamic from 'next/dynamic';
import { ClipboardList, Plus } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { isAdminProfile, isRootProfile } from '@/lib/authz';
import type { SyncState } from '@/lib/types';
import BrandLogo from './BrandLogo';
import HamburgerMenu from './HamburgerMenu';
import StatusBadge from './StatusBadge';

const RoleManagementModal = dynamic(() => import('./RoleManagementModal'), { ssr: false });

interface HeaderProps {
  syncState?: SyncState;
  title?: string;
  subtitle?: string;
  onOpenAudit?: () => void;
  onOpenAddProduct?: () => void;
}

const ROLE_LABEL = { SUPER_ADMIN: 'Root Owner', ADMIN: 'Admin', BASIC: 'Field Sales' } as const;

export default function Header({ syncState, title = 'KONJO Inventory', subtitle = 'Addis Ababa operations', onOpenAudit, onOpenAddProduct }: HeaderProps) {
  const { profile } = useAuth();
  const canManageRoles = isRootProfile(profile);
  const homeHref = isAdminProfile(profile) ? '/admin' : '/outlets';
  const homeLabel = isAdminProfile(profile) ? 'Return to Admin Dashboard' : 'Return to Outlets Portal';
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-konjo-charcoal/90 backdrop-blur-lg">
      <div className="bg-mitmita-glow pointer-events-none absolute inset-x-0 top-0 h-28 opacity-60" />
      <div className="relative mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href={homeHref} aria-label={homeLabel} title={homeLabel} className="shrink-0 rounded-xl transition active:scale-95">
              <BrandLogo size={40} />
            </Link>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <Link href={homeHref} title={homeLabel} className="truncate font-display text-sm font-semibold text-konjo-cream transition hover:text-white">
                  {profile?.username}
                </Link>
                {profile && <span className="shrink-0 rounded-full border border-konjo-amber/25 bg-konjo-amber/10 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-konjo-amber">{ROLE_LABEL[profile.role]}</span>}
              </div>
              <p className="truncate text-[10.5px] text-konjo-cream/45">{title} · {subtitle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {syncState && <StatusBadge state={syncState} />}
            {onOpenAudit && (
              <button onClick={onOpenAudit} aria-label="Open audit ledger" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-konjo-cream/80 transition active:scale-90 active:bg-white/15">
                <ClipboardList size={17} strokeWidth={2.2} />
              </button>
            )}
            {onOpenAddProduct && (
              <button onClick={onOpenAddProduct} aria-label="Add product" className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-konjo-red to-konjo-red-deep text-white shadow-lg shadow-konjo-red/30 transition active:scale-90">
                <Plus size={18} strokeWidth={2.5} />
              </button>
            )}
            <HamburgerMenu />
          </div>
        </div>
      </div>
      {canManageRoles && <RoleManagementModal />}
    </header>
  );
}
