'use client';
import { useState } from 'react';
import { EditorShell } from './EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { setZoneSuitability } from '../../../../lib/api';

const RATINGS = ['SUITABLE', 'MARGINAL', 'UNSUITABLE'];

export function ZoneSuitabilityEditor({ cropId, zones }: { cropId: string; zones: { id: string; name: string }[] }) {
  const [zoneId, setZoneId] = useState(''); const [rating, setRating] = useState(RATINGS[0]); const [justification, setJustification] = useState('');
  if (zones.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord une <a href="/zones" className="underline">zone</a> pour la rattacher.</p>;
  }
  return (
    <EditorShell label="+ Rattacher une zone">
      {({ submit, close, busy }) => (
        <form
          onSubmit={(e) => { e.preventDefault(); if (!zoneId) return; submit(() => setZoneSuitability(cropId, zoneId, { rating, justification: justification || undefined })); }}
          className="space-y-2 text-sm"
        >
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger><SelectValue placeholder="— Zone —" /></SelectTrigger>
            <SelectContent>
              {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rating} onValueChange={setRating}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RATINGS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="justification (optionnel)" value={justification} onChange={(e) => setJustification(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>Annuler</Button>
            <Button type="submit" size="sm" disabled={busy}>Rattacher</Button>
          </div>
        </form>
      )}
    </EditorShell>
  );
}
