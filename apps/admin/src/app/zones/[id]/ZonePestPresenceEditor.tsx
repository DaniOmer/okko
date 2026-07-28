'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { labelOf, FREQUENCY_LABELS, PEST_KIND_LABELS } from '@/lib/labels';
import { setZonePest, removeZonePest } from '@/lib/actions';
import type { ZonePestView } from '@/lib/api';

const FREQ = ['OCCASIONAL', 'FREQUENT', 'ENDEMIC'];

export function ZonePestPresenceEditor({ zoneId, links, allPests }: {
  zoneId: string;
  links: ZonePestView[];
  allPests: { id: string; name: string; kind?: string }[];
}) {
  const router = useRouter();
  const [pestId, setPestId] = useState('');
  const [frequency, setFrequency] = useState('FREQUENT');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkedIds = new Set(links.map((l) => l.pestId));
  const options = allPests.filter((p) => !linkedIds.has(p.id));

  async function run(fn: () => Promise<unknown>, onSuccess?: () => void) {
    setBusy(true); setError(null);
    try { await fn(); onSuccess?.(); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setBusy(false); }
  }

  const byKind = (kind: string) => links.filter((l) => (l.kind ?? 'ANIMAL') === kind);
  const groups: [string, string][] = [['ANIMAL', 'Ravageurs'], ['DISEASE', 'Maladies'], ['WEED', 'Adventices']];

  return (
    <section className="space-y-3 border-t pt-4">
      <h2 className="text-base font-semibold">Bioagresseurs fréquents <span className="font-normal text-muted-foreground">({links.length})</span></h2>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {links.length === 0 && <p className="text-sm text-muted-foreground">Aucun bioagresseur rattaché.</p>}
      {groups.map(([kind, label]) => byKind(kind).length > 0 && (
        <div key={kind} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <ul className="space-y-1 text-sm">
            {byKind(kind).map((l) => (
              <li key={l.pestId} className="flex items-center gap-2">
                <span>{l.pestName.fr ?? l.pestId}</span>
                <Badge variant="secondary">{labelOf(FREQUENCY_LABELS, l.frequency)}</Badge>
                {confirmId === l.pestId ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Détacher ?</span>
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmId(null)}>Annuler</Button>
                    <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => run(() => removeZonePest(zoneId, l.pestId), () => setConfirmId(null))}>Détacher</Button>
                  </span>
                ) : (
                  <button type="button" className="text-xs text-destructive" onClick={() => setConfirmId(l.pestId)}>Détacher</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-2 pt-2">
        <div className="min-w-48 flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Ajouter un bioagresseur</label>
          <Select value={pestId} onValueChange={setPestId}>
            <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
            <SelectContent>
              {options.length === 0
                ? <div className="px-2 py-1.5 text-sm text-muted-foreground">Tous déjà rattachés</div>
                : options.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.kind ? ` (${labelOf(PEST_KIND_LABELS, p.kind)})` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1">
          <label className="text-xs text-muted-foreground">Fréquence</label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FREQ.map((f) => <SelectItem key={f} value={f}>{labelOf(FREQUENCY_LABELS, f)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" disabled={busy || !pestId} onClick={() => run(() => setZonePest(zoneId, pestId, frequency), () => setPestId(''))}>Rattacher</Button>
      </div>
    </section>
  );
}
