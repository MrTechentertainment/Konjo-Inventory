/* Blob previews and dynamic Supabase URLs must bypass Next image optimization. */
/* eslint-disable @next/next/no-img-element */
'use client';

import { ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { validateProductImage } from '@/lib/productImages';
import type { Product } from '@/lib/types';

interface Props {
  product: Product | null;
  onClose: () => void;
  onSave: (product: Product, file: File | null) => Promise<boolean>;
}

export default function ProductImageModal({ product, onClose, onSave }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!product) return null;

  const choose = (nextFile: File | undefined) => {
    if (!nextFile) return;
    const validation = validateProductImage(nextFile);
    if (validation) { setError(validation); return; }
    setError(null);
    setFile(nextFile);
  };

  const submit = async (nextFile: File | null) => {
    setSaving(true);
    setError(null);
    const ok = await onSave(product, nextFile);
    setSaving(false);
    if (ok) onClose();
    else setError('The product image did not save. Check the connection and try again.');
  };

  const displayedImage = preview ?? product.image_url;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="product-image-title" onClick={onClose} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-konjo-charcoal-2 p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between"><div><p id="product-image-title" className="font-display text-base font-bold text-konjo-cream">Product image</p><p className="mt-1 text-xs text-konjo-cream/40">{product.name} · Root Owner only</p></div><button onClick={onClose} aria-label="Close product image editor" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-konjo-cream/50"><X size={15} /></button></div>
        <div className="mt-4 flex h-56 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">{displayedImage ? <img src={displayedImage} alt={`${product.name} preview`} className="h-full w-full object-contain object-center" /> : <div className="text-center text-konjo-cream/30"><ImagePlus className="mx-auto" size={34} /><p className="mt-2 text-xs">No image uploaded</p></div>}</div>
        <p className="mt-3 text-[11px] leading-relaxed text-konjo-cream/40">JPG, PNG or WebP, up to 10 MB. The browser resizes it to fit within 900 × 900 px without cropping, stretching or elongating it.</p>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => choose(event.target.files?.[0])} />
        {error && <p role="alert" className="mt-3 rounded-xl bg-konjo-red/10 p-3 text-xs text-konjo-red">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={saving} onClick={() => inputRef.current?.click()} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-konjo-cream/65"><Upload size={14} />{product.image_url ? 'Replace image' : 'Choose image'}</button><button disabled={saving || !file} onClick={() => void submit(file)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-konjo-red text-xs font-semibold text-white disabled:opacity-40">{saving ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}Save image</button></div>
        {product.image_url && <button disabled={saving} onClick={() => void submit(null)} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-konjo-red/20 bg-konjo-red/5 text-xs text-konjo-red disabled:opacity-40"><Trash2 size={13} />Remove current image</button>}
      </div>
    </div>
  );
}
