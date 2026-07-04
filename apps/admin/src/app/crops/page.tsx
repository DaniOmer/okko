import Link from 'next/link';
import { listCrops } from '../../lib/api';

export default async function CropsPage() {
  const crops = await listCrops();
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Fiches culture</h1>
        <Link href="/crops/new" className="rounded bg-green-700 px-4 py-2 text-white">Nouvelle culture</Link>
      </div>
      <ul className="divide-y">
        {crops.map((c) => (
          <li key={c.id} className="py-3 flex justify-between">
            <Link href={`/crops/${c.id}`} className="text-green-800 underline">{c.name}</Link> — <em>{c.scientificName}</em> · {c.cycleType}
            <span className="text-sm">{c.status} (v{c.version})</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
