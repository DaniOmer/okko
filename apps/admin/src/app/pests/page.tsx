import Link from 'next/link';
import { listPests } from '../../lib/api';

export default async function PestsPage() {
  const pests = await listPests();
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ravageurs &amp; maladies</h1>
        <Link href="/pests/new" className="rounded bg-green-700 px-4 py-2 text-white">Nouveau</Link>
      </div>
      <ul className="divide-y">
        {pests.map((p) => (
          <li key={p.id} className="py-3">{p.name} — {p.type}{p.scientificName ? ` · ${p.scientificName}` : ''}</li>
        ))}
      </ul>
    </main>
  );
}
