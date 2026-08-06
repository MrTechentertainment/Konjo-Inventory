'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert, X } from 'lucide-react';

export default function ErrorToast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-sm items-start gap-2.5 rounded-2xl border border-konjo-red/30 bg-konjo-charcoal-2/95 p-3.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-konjo-red" />
          <p className="flex-1 text-[12.5px] leading-snug text-konjo-cream/90">{message}</p>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 text-konjo-cream/40 transition active:text-konjo-cream"
          >
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
