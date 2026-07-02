'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCrop } from '../../../lib/api';

const CYCLE_TYPES = ['SEASONAL_ANNUAL', 'BIENNIAL', 'PERENNIAL_HERBACEOUS', 'PERENNIAL_WOODY_FRUIT', 'FORESTRY_WOOD'];

export default function NewCropPage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [scientificName, setSci] = useState('');
  const [family, setFamily] = useState('');
  const [cycleType, setCycle] = useState(CYCLE_TYPES[0]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await createCrop({ commonNames: { fr }, scientificName, family, cycleType });
    router.push('/crops');
  }

  return (
    <main className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Nouvelle culture</h1>
      <form onSubmit={submit} className="space-y-4">
        <input className="w-full border p-2" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
        <input className="w-full border p-2" placeholder="Nom scientifique" value={scientificName} onChange={(e) => setSci(e.target.value)} required />
        <input className="w-full border p-2" placeholder="Famille" value={family} onChange={(e) => setFamily(e.target.value)} required />
        <select className="w-full border p-2" value={cycleType} onChange={(e) => setCycle(e.target.value)}>
          {CYCLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="submit" className="rounded bg-green-700 px-4 py-2 text-white">Créer</button>
      </form>
    </main>
  );
}
