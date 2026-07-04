import Link from 'next/link';
import { listZones } from '../../lib/api';

export default async function ZonesPage() {
  const zones = await listZones();
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Zones agro-écologiques</h1>
        <Link href="/zones/new" className="rounded bg-green-700 px-4 py-2 text-white">Nouvelle zone</Link>
      </div>
      <ul className="divide-y">
        {zones.map((z) => (
          <li key={z.id} className="py-3">{z.name} — {z.country}{z.koppen ? ` · ${z.koppen}` : ''}</li>
        ))}
      </ul>
    </main>
  );
}
