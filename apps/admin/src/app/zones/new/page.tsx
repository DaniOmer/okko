'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createZone } from '@/lib/actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoneFields, emptyZoneForm, zoneFormToPayload, type ZoneFormValue } from '../ZoneFields';

export default function NewZonePage() {
  const router = useRouter();
  const [form, setForm] = useState<ZoneFormValue>(emptyZoneForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await createZone(zoneFormToPayload(form));
      router.refresh();
      router.push('/zones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setBusy(false); }
  }

  return (
    <main className="p-8 max-w-lg">
      <Card>
        <CardHeader><CardTitle>Nouvelle zone</CardTitle></CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-destructive">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            <ZoneFields value={form} onChange={setForm} />
            <Button type="submit" disabled={busy}>Créer</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
