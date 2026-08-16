"use client";

import Image from "next/image";
import { useState } from "react";

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9IiMyOTI1MjQiLz48L3N2Zz4=";

export default function ItemAsset({ src, alt, fallback, size = 48 }: { src?: string; alt: string; fallback?: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-md bg-stone-800" style={{ width: size }}>
      {src && !failed ? (
        <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-contain" placeholder="blur" blurDataURL={BLUR_DATA_URL} onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden className="text-2xl">{fallback || "🕯️"}</span>
      )}
    </span>
  );
}
