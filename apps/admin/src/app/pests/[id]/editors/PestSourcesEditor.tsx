'use client';
import { useState } from 'react';
import { EditorShell } from '@/components/EditorShell';
import { SourcesEditor, type SourceRow } from '@/components/SourcesEditor';
import { Button } from '@/components/ui/button';
import { setPestSources } from '@/lib/actions';
import type { Pest } from '@/lib/api';

export function PestSourcesEditor({ pest }: { pest: Pest }) {
  const [sources, setSources] = useState<SourceRow[]>(pest.sources ?? []);

  return (
    <EditorShell label="Modifier les sources">
      {({ submit, close, busy }) => (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <SourcesEditor value={sources} onChange={setSources} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => submit(async () => {
              await setPestSources(pest.id, { sources: sources.filter((s) => s.title.trim() !== '') });
            })}>Enregistrer</Button>
          </div>
        </div>
      )}
    </EditorShell>
  );
}
