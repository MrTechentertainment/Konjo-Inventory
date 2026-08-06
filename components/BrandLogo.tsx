import Image from 'next/image';

export default function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl bg-black shadow-lg shadow-black/30"
      style={{ width: size, height: size }}
    >
      <Image src="/logo.png" alt="KONJO Foods" fill sizes={`${size}px`} className="object-contain" priority />
    </div>
  );
}
