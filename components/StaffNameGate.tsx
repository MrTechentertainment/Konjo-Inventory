'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function StaffNameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    onSubmit(trimmed);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-konjo-charcoal px-6">
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        onSubmit={handleSubmit}
        className="w-full max-w-xs rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-center shadow-2xl backdrop-blur-md"
      >
        <div className="mx-auto mb-3 h-12 w-12 overflow-hidden rounded-2xl bg-white/95 p-1.5 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.konjofoods.et/images/konjo-logo-transparent.png"
            alt="Konjo Foods"
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="font-display text-lg font-semibold text-konjo-cream">Welcome to KONJO Inventory</h1>
        <p className="mt-1 text-[12.5px] text-konjo-cream/50">
          What's your name? It's attached to every stock change you log.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Selam"
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-center text-[14px] text-konjo-cream placeholder:text-konjo-cream/30 focus:outline-none focus:ring-2 focus:ring-konjo-red/40"
        />
        <button
          type="submit"
          disabled={name.trim().length < 2}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-br from-konjo-red to-konjo-red-deep font-display text-[13.5px] font-semibold text-white shadow-lg shadow-konjo-red/30 transition active:scale-[0.98] disabled:opacity-40"
        >
          Start logging stock
        </button>
        <p className="mt-3 text-[10px] text-konjo-cream/30">
          This just labels your entries on this device — it isn't a password.
        </p>
      </motion.form>
    </div>
  );
}
