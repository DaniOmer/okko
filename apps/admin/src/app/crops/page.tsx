import Link from 'next/link';
import { listCrops } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

export default async function CropsPage({ searchParams }: { searchParams: { q?: string } }) {
  const raw = (searchParams.q ?? '').trim();
  const q = raw.toLowerCase();
  const all = await listCrops().catch(() => []);
  const crops = q
    ? all.filter((c) => c.name.toLowerCase().includes(q) || c.scientificName.toLowerCase().includes(q))
    : all;
  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fiches culture</h1>
        <Button asChild><Link href="/crops/new">Nouvelle culture</Link></Button>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {crops.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/crops/${c.id}`} className="text-primary hover:underline">{c.name}</Link>
                  </TableCell>
                  <TableCell className="italic text-muted-foreground">{c.scientificName}</TableCell>
                  <TableCell>{c.cycleType}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'PUBLISHED' ? 'default' : 'secondary'}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{c.completeness?.percent ?? '—'}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
