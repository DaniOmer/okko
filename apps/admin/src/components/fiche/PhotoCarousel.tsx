'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImageRef } from '@/lib/api';

export function PhotoCarousel({ images }: { images: ImageRef[] }) {
  const [index, setIndex] = useState(0);
  if (!images.length) return null;

  const n = images.length;
  const current = images[index];
  const go = (delta: number) => setIndex((p) => (p + delta + n) % n);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border bg-[#f8faf8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.caption ?? ''} className="mx-auto h-72 w-full object-contain" />
        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="Photo précédente"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#245c27] shadow hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Photo suivante"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#245c27] shadow hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white">
              {index + 1}/{n}
            </span>
          </>
        )}
      </div>
      {current.caption && <p className="text-center text-xs text-muted-foreground">{current.caption}</p>}
      {n > 1 && (
        <div className="flex justify-center gap-2 pt-0.5">
          {images.map((img, k) => (
            <button
              key={img.key}
              type="button"
              aria-label={`Aller à la photo ${k + 1}`}
              onClick={() => setIndex(k)}
              className={`h-1.5 rounded-full transition-all ${k === index ? 'w-5 bg-[#245c27]' : 'w-1.5 bg-[#cbd5c9] hover:bg-[#a3b3a0]'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
