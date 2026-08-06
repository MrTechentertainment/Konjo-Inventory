'use client';

import { motion } from 'framer-motion';
import type { SyncState } from '@/lib/types';

const COPY: Record<SyncState, string> = {
  online: 'Online',
  syncing: 'Syncing',
  offline: 'Offline',
};

const DOT_CLASS: Record<SyncState, string> = {
  online: 'bg-konjo-green',
  syncing: 'bg-konjo-amber',
  offline: 'bg-konjo-red',
};

export default function StatusBadge({ state }: { state: SyncState }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 backdrop-blur-md">
      <span className="relative flex h-1.5 w-1.5">
        {state !== 'offline' && (
          <motion.span
            className={`absolute inline-flex h-full w-full rounded-full ${DOT_CLASS[state]}`}
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${DOT_CLASS[state]}`} />
      </span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-white/80">
        {COPY[state]}
      </span>
    </div>
  );
}
