'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPest } from '../../../lib/api';

const TYPES = ['INSECT', 'FUNGUS', 'BACTERIA', 'VIRUS', 'WEED', 'NEMATODE', 'OTHER'];

export default function NewPestPage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [type, setType] = useState(TYPES[0]);
  const [scientificName, setSci] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createPest({ name: { fr }, type, scientificName: scientificName || undefined });
      router.push('/pests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <main className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Nouveau ravageur / maladie</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      <form onSubmit={submit} className="space-y-4">
        <input className="w-full border p-2" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
        <select className="w-full border p-2" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="w-full border p-2" placeholder="Nom scientifique (optionnel)" value={scientificName} onChange={(e) => setSci(e.target.value)} />
        <button type="submit" className="rounded bg-green-700 px-4 py-2 text-white">Créer</button>
      </form>
    </main>
  );
}
