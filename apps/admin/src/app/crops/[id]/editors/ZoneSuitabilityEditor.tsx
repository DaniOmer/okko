'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SUITABILITY_LABELS } from '@/lib/labels';
import { setZoneSuitability } from '../../../../lib/api';

export function ZoneSuitabilityEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] }) {
  const [zoneId, setZoneId] = useState(''); const [rating, setRating] = useState('SUITABLE'); const [justification, setJustification] = useState('');
  if (zones.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour la rattacher.</p>;
  }
  return (
    <EditorShell label="+ Rattacher une zone">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!zoneId) return; submit(() => setZoneSuitability(cropId, zoneId, { rating, justification: justification || undefined })); }}
          className="space-y-3 text-sm"
        >
          <div className="space-y-1">
            <Label>Zone *</Label>
            <Select value={zoneId} onValueChange={setZoneId}>
              <SelectTrigger><SelectValue placeholder="— Choisir une zone —" /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Aptitude</Label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SUITABILITY_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="zone-justif">Justification</Label>
            <Textarea id="zone-justif" placeholder="ex. pluviométrie insuffisante en saison sèche…" value={justification} onChange={(e) => setJustification(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Rattacher</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
