import Link from 'next/link';
import { listCrops } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { labelOf, CYCLE_TYPE_LABELS, CROP_STATUS_LABELS } from '@/lib/labels';
import { UnarchiveButton } from './UnarchiveButton';

export default async function CropsPage({ searchParams }: { searchParams: { q?: string; archived?: string } }) {
  const raw = (searchParams.q ?? '').trim();
  const q = raw.toLowerCase();
  const showArchived = searchParams.archived === '1';
  const all = await listCrops().catch(() => []);
  const archivedCount = all.filter((c) => c.status === 'ARCHIVED').length;
  const base = showArchived
    ? all.filter((c) => c.status === 'ARCHIVED')
    : all.filter((c) => c.status !== 'ARCHIVED');
  const crops = q
    ? base.filter((c) => c.name.toLowerCase().includes(q) || c.scientificName.toLowerCase().includes(q))
    : base;

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        {showArchived ? (
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Cultures archivées</h1>
            <Link href="/crops" className="text-sm text-primary hover:underline">← Cultures actives</Link>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Fiches culture</h1>
            {archivedCount > 0 && (
              <Link href="/crops?archived=1" className="text-sm text-muted-foreground hover:underline">
                Archivées ({archivedCount})
              </Link>
            )}
          </div>
        )}
        {!showArchived && (
          <Button asChild><Link href="/crops/new">Nouvelle culture</Link></Button>
        )}
      </div>
      {raw && <p className="text-sm text-muted-foreground">Résultats pour &laquo;&nbsp;{raw}&nbsp;&raquo; ({crops.length})</p>}
      {crops.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aucune culture.</div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Nom scientifique</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Complétude</TableHead>
                {showArchived && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {crops.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/crops/${c.id}`} className="text-primary hover:underline">{c.name}</Link>
                  </TableCell>
                  <TableCell className="italic text-muted-foreground">{c.scientificName}</TableCell>
                  <TableCell>{labelOf(CYCLE_TYPE_LABELS, c.cycleType)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === 'PUBLISHED' ? 'default' : 'secondary'}>{labelOf(CROP_STATUS_LABELS, c.status)}</Badge>
                      {c.hasUnpublishedChanges && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">modifs non publiées</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{c.completeness?.percent ?? '—'}%</TableCell>
                  {showArchived && (
                    <TableCell className="text-right">
                      <UnarchiveButton cropId={c.id} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
