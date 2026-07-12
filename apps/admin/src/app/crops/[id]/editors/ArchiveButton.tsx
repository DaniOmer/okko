'use client';
import { useRouter } from 'next/navigation';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { archiveCrop, unarchiveCrop } from '../../../../lib/api';

export function ArchiveButton({ cropId, archived }: { cropId: string; archived: boolean }) {
  const router = useRouter();

  if (!archived) {
    return (
      <EditorShell label="Archiver">
        {({ submit, close, busy }) => (
          <div className="space-y-2">
            <p className="text-sm">Archiver cette culture ? Elle sera retirée de la liste.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
              <Button size="sm" disabled={busy}
                onClick={() => submit(async () => { await archiveCrop(cropId); router.push('/crops'); })}>
                Archiver
              </Button>
            </div>
          </div>
        )}
      </EditorShell>
    );
  }

  return (
    <EditorShell label="Désarchiver">
      {({ submit, close, busy }) => (
        <div className="space-y-2">
          <p className="text-sm">Désarchiver cette culture ? Elle repassera en brouillon.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button size="sm" disabled={busy}
              onClick={() => submit(() => unarchiveCrop(cropId))}>
              Désarchiver
            </Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
