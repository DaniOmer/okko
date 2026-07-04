'use client';
import { EditorShell } from './EditorShell';
import { publishCrop } from '../../../../lib/api';

export function PublishButton({ cropId, status }: { cropId: string; status: string }) {
  if (status === 'PUBLISHED') return <span className="text-sm text-gray-500">Publiée</span>;
  return (
    <EditorShell label="Publier">
      {({ submit, close, busy }) => (
        <div className="space-y-2">
          <p className="text-sm">Publier cette fiche ?</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => submit(() => publishCrop(cropId))} className="rounded bg-green-700 px-3 py-1 text-sm text-white">Confirmer</button>
            <button onClick={close} className="text-sm">Annuler</button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
