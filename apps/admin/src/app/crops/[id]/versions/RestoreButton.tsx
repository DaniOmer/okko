'use client';
import { useRouter } from 'next/navigation';
import { EditorShell } from '../editors/EditorShell';
import { Button } from '@/components/ui/button';
import { restoreVersion } from '../../../../lib/api';

export function RestoreButton({ cropId, revision }: { cropId: string; revision: number }) {
  const router = useRouter();
  return (
    <EditorShell label="Restaurer">
      {({ submit, close, busy }) => (
        <div className="space-y-2">
          <p className="text-sm">Restaurer la version {revision} dans le brouillon ? Cela remplace le contenu du brouillon courant.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button size="sm" disabled={busy}
              onClick={() => submit(async () => { await restoreVersion(cropId, revision); router.push(`/crops/${cropId}`); })}>
              Restaurer
            </Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
