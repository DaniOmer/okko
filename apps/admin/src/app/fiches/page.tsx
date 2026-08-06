import Link from 'next/link';
import { listPublishedCrops } from '@/lib/api';

export default async function FichesPage() {
  const crops = await listPublishedCrops().catch(() => []);
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fiches culture</h1>
        <p className="text-sm text-muted-foreground">Consultez les cultures publiées de la base de connaissances.</p>
      </div>
      {crops.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune fiche publiée pour l&apos;instant.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {crops.map((c) => (
            <li key={c.id}>
              <Link href={`/fiches/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-accent">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs italic text-muted-foreground">{c.scientificName}{c.family ? ` · ${c.family}` : ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
