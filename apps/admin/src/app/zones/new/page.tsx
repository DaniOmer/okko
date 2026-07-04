'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createZone } from '../../../lib/api';

export default function NewZonePage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [country, setCountry] = useState('');
  const [koppen, setKoppen] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createZone({ name: { fr }, country, koppen: koppen || undefined });
      router.push('/zones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <main className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Nouvelle zone</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <input className="w-full border p-2" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
        <input className="w-full border p-2" placeholder="Pays (ex. BJ)" value={country} onChange={(e) => setCountry(e.target.value)} required />
        <input className="w-full border p-2" placeholder="Köppen (optionnel)" value={koppen} onChange={(e) => setKoppen(e.target.value)} />
        <button type="submit" className="rounded bg-green-700 px-4 py-2 text-white">Créer</button>
      </form>
    </main>
  );
}
