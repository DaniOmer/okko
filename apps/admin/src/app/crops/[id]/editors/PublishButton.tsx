'use client';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { publishCrop } from '../../../../lib/api';

export function PublishButton({ cropId, status }: { cropId: string; status: string }) {
  if (status === 'PUBLISHED') return <span className="text-sm text-muted-foreground">Publiée</span>;
  return (
    <EditorShell label="Publier">
      {({ submit, close, busy }) => (
        <div className="space-y-2">
          <p className="text-sm">Publier cette fiche ?</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => submit(() => publishCrop(cropId))}>Confirmer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
