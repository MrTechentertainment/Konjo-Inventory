/* Dynamic Supabase image URLs are already resized and intentionally rendered as-is. */
/* eslint-disable @next/next/no-img-element */

import { ImageIcon } from 'lucide-react';

export default function ProductThumbnail({ imageUrl, alt, className = 'h-20 w-full' }: { imageUrl: string | null | undefined; alt: string; className?: string }) {
  return <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/15 p-1.5 ${className}`}>{imageUrl ? <img src={imageUrl} alt={alt} loading="lazy" className="h-full w-full object-contain object-center" /> : <ImageIcon size={20} className="text-konjo-cream/15" />}</span>;
}
