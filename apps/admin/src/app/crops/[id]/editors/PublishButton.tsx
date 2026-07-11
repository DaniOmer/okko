'use client';
import Link from 'next/link';
import { EditorShell } from './EditorShell';
import { PublishDialog } from './PublishDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { discardDraft } from '../../../../lib/api';

export function PublishButton({
  cropId,
  hasUnpublishedChanges,
  hasPublishedVersion,
}: {
  cropId: string;
  status: string; // passé par la page mais volontairement inutilisé — la logique s'appuie sur les drapeaux
  hasUnpublishedChanges: boolean;
  hasPublishedVersion: boolean;
}) {
  // 1) Jamais publiée : premier publish.
  if (!hasPublishedVersion) {
    return <PublishDialog cropId={cropId} label="Publier" prompt="Publier cette fiche ?" />;
  }

  const publishedLink = (
    <Link href={`/crops/${cropId}/published`} className="text-sm text-primary hover:underline">
      Voir la version publiée
    </Link>
  );

  // 2) Publiée, sans modifications en attente.
  if (!hasUnpublishedChanges) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Publiée</span>
        {publishedLink}
      </div>
    );
  }

  // 3) Publiée, avec modifications non publiées.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="border-amber-500 text-amber-700">Modifications non publiées</Badge>
      <PublishDialog cropId={cropId} label="Republier" prompt="Republier la fiche avec les modifications en cours ?" />
      <EditorShell label="Abandonner">
        {({ submit, close, busy }) => (
          <div className="space-y-2">
            <p className="text-sm">Abandonner les modifications non publiées et revenir à la version publiée ? Action irréversible.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
              <Button variant="destructive" size="sm" disabled={busy} onClick={() => submit(() => discardDraft(cropId))}>Abandonner</Button>
            </div>
          </div>
        )}
      </EditorShell>
      {publishedLink}
    </div>
  );
}
