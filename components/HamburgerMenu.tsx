'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Building2, CircleDollarSign, Factory, LogOut, Menu, Settings, ShieldCheck, UsersRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
  const isRoot = profile?.username.toLowerCase() === 'natanim' && profile.role === 'SUPER_ADMIN';

  const links = [
    ...(isAdmin ? [{ href: '/', label: 'Factory Inventory', icon: Factory }] : []),
    { href: '/outlets', label: 'Outlets Portal', icon: Building2 },
    ...(isAdmin ? [{ href: '/outlets/tracker', label: 'Outlet Operations Tracker', icon: ShieldCheck }] : []),
    ...(isAdmin ? [{ href: '/admin/prices', label: 'Prices & Tax', icon: CircleDollarSign }] : []),
    ...((isRoot || profile?.analytics_access) ? [{ href: '/analytics', label: 'Analytics', icon: BarChart3 }] : []),
    { href: '/account', label: 'Account Management', icon: Settings },
    ...(isRoot ? [{ href: '/admin/users', label: 'User Role Management', icon: UsersRound }] : []),
  ];

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open menu" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-konjo-cream/80 active:scale-90"><Menu size={18} /></button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-[70] flex justify-end bg-black/65">
            <motion.nav initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.2 }} onClick={(event) => event.stopPropagation()} className="flex h-dvh w-[85%] max-w-xs flex-col border-l border-white/10 bg-konjo-charcoal-2 p-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div><p className="font-display font-semibold text-konjo-cream">Operations menu</p><p className="text-[11px] text-konjo-cream/40">{profile?.username}</p></div>
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-konjo-cream/60"><X size={17} /></button>
              </div>
              <div className="mt-4 space-y-2">
                {links.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm ${pathname === href ? 'border-konjo-red/35 bg-konjo-red/15 text-konjo-cream' : 'border-white/10 bg-white/[0.03] text-konjo-cream/65'}`}>
                    <Icon size={17} />{label}
                  </Link>
                ))}
              </div>
              <button onClick={() => void logout()} className="mt-auto flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-konjo-cream/60"><LogOut size={17} />Sign out</button>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
