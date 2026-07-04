import Link from 'next/link';
import { listCrops, listZones, listPests } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function DashboardPage() {
  // Résilient : un endpoint indisponible dégrade sa carte à zéro plutôt que
  // de faire planter tout le tableau de bord.
  const [crops, zones, pests] = await Promise.all([
    listCrops().catch(() => []),
    listZones().catch(() => []),
    listPests().catch(() => []),
  ]);

  const published = crops.filter((c) => c.status === 'PUBLISHED').length;
  const drafts = crops.length - published;
  const avgCompleteness = crops.length
    ? Math.round(crops.reduce((s, c) => s + (c.completeness?.percent ?? 0), 0) / crops.length)
    : 0;
  const recent = crops.slice(0, 6);

  const stats = [
    { label: 'Cultures', value: crops.length, href: '/crops' },
    { label: 'Publiées', value: published, href: '/crops' },
    { label: 'Brouillons', value: drafts, href: '/crops' },
    { label: 'Complétude moy.', value: `${avgCompleteness}%`, href: '/crops' },
    { label: 'Zones', value: zones.length, href: '/zones' },
    { label: 'Ravageurs', value: pests.length, href: '/pests' },
  ];

  return (
    <main className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Vue d&apos;ensemble de la base de connaissances.</p>
        </div>
        <Link href="/crops/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Nouvelle culture
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="transition-colors hover:border-primary rounded-lg">
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cultures récentes</h2>
          <Link href="/crops" className="text-sm text-primary hover:underline">Tout voir</Link>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucune culture pour le moment.{' '}
            <Link href="/crops/new" className="text-primary hover:underline">En créer une</Link>.
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {recent.map((c) => (
                  <li key={c.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <Link href={`/crops/${c.id}`} className="font-medium hover:text-primary hover:underline">
                        {c.name}
                      </Link>
                      <span className="ml-2 text-sm italic text-muted-foreground">{c.scientificName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Badge variant={c.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                        {c.status}
                      </Badge>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {c.completeness?.percent ?? '—'}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
