'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { ImageGalleryUploader } from '@/components/ImageGalleryUploader';
import { CROP_PHOTO_CATEGORY_LABELS } from '@/lib/labels';
import { setCropImages } from '@/lib/actions';
import type { ImageRef } from '@/lib/api';

export function ImagesEditor({ cropId, current }: { cropId: string; current: ImageRef[] }) {
  const [local, setLocal] = useState<ImageRef[]>(current);

  return (
    <EditorShell label="Modifier les photos">
      {({ submit, close, busy }) => (
        <div className="space-y-3">
          <ImageGalleryUploader value={local} onChange={setLocal} categories={Object.entries(CROP_PHOTO_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() =>
                submit(async () => {
                  await setCropImages(cropId, local.map((i) => ({ key: i.key, caption: i.caption, category: i.category })));
                })
              }
            >
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
