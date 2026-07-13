'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { publishCrop } from '@/lib/actions';

export function PublishDialog({
  cropId,
  label,
  prompt,
}: {
  cropId: string;
  label: string;
  prompt: string;
}) {
  const [note, setNote] = useState('');
  return (
    <EditorShell label={label}>
      {({ submit, close, busy }) => (
        <div className="space-y-2">
          <p className="text-sm">{prompt}</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note optionnelle (ex. Ajout variété Obatanpa, MAJ prix)"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button size="sm" disabled={busy} onClick={() => submit(() => publishCrop(cropId, note))}>Confirmer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
