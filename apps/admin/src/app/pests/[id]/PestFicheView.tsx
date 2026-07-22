'use client';

import type { Pest } from '../../../lib/api';
import { labelOf, PEST_TYPE_LABELS, PEST_PHOTO_CATEGORY_LABELS } from '@/lib/labels';
import { PhotoCarousel } from '@/components/fiche/PhotoCarousel';
import { Images } from 'lucide-react';

export function PestFicheView({ pest }: { pest: Pest }) {
  const photos = (pest.images ?? []).map((img) => ({
    ...img,
    caption: [img.category ? labelOf(PEST_PHOTO_CATEGORY_LABELS, img.category) : '', img.caption]
      .filter(Boolean).join(' — ') || undefined,
  }));

  return (
    <div>
      {/* Hero */}
      <div className="flex gap-5 rounded-xl px-6 py-7" style={{ background: 'linear-gradient(135deg,#fdf0f0,#fbfdfb)' }}>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{pest.name}</h1>
          {pest.scientificName && <p className="mt-0.5 text-sm italic text-muted-foreground">{pest.scientificName}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-block rounded-full bg-[#f4e6e6] px-3 py-1 text-[13px] font-semibold text-[#8a2c2c]">
              🐛 {labelOf(PEST_TYPE_LABELS, pest.type)}
            </span>
            {pest.family && (
              <span className="inline-block rounded-full bg-[#eee] px-3 py-1 text-[13px] text-[#475569]">
                Famille : {pest.family}
              </span>
            )}
          </div>
          {pest.description?.fr && (
            <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[#374151]">{pest.description.fr}</p>
          )}
        </div>
        {photos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[0].url} alt={photos[0].caption ?? pest.name} className="h-28 w-28 shrink-0 rounded-2xl border border-[#e8dddd] object-cover" />
        )}
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <div className="px-6">
          <section id="photos" className="scroll-mt-16 border-t py-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-[#f4e6e6] text-[#8a2c2c]">
                <Images className="h-4 w-4" />
              </span>
              Photos
              <span className="font-normal text-muted-foreground">({photos.length})</span>
            </h2>
            <PhotoCarousel images={photos} />
          </section>
        </div>
      )}
    </div>
  );
}
