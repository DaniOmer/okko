import Link from 'next/link';
import { listPests } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { labelOf, PEST_TYPE_LABELS, PEST_KIND_LABELS, WEED_CATEGORY_LABELS } from '@/lib/labels';
import { PestRowActions } from './PestRowActions';

export default async function PestsPage({ searchParams }: { searchParams: { kind?: string } }) {
  const all = await listPests().catch(() => []);
  const kindFilter = searchParams.kind; // 'ANIMAL' | 'WEED' | undefined
  const pests = kindFilter ? all.filter((p) => (p.kind ?? 'ANIMAL') === kindFilter) : all;
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bioagresseurs</h1>
        <Button asChild>
          <Link href="/pests/new">Nouveau bioagresseur</Link>
        </Button>
      </div>
      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/pests" className={!kindFilter ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'}>Tous</Link>
        <Link href="/pests?kind=ANIMAL" className={kindFilter === 'ANIMAL' ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'}>Ravageurs</Link>
        <Link href="/pests?kind=WEED" className={kindFilter === 'WEED' ? 'font-semibold text-primary' : 'text-muted-foreground hover:underline'}>Adventices</Link>
      </div>
      {pests.length === 0 ? (
        <div className="rounded border-2 border-dashed p-8 text-center text-muted-foreground">
          Aucun bioagresseur enregistré.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Nom scientifique</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pests.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0].url} alt={p.images[0].caption ?? ''} className="h-8 w-10 rounded object-cover" />
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/pests/${p.id}`} className="text-primary hover:underline">{p.name}</Link>
                </TableCell>
                <TableCell><Badge variant="secondary">{labelOf(PEST_KIND_LABELS, p.kind ?? 'ANIMAL')}</Badge></TableCell>
                <TableCell>{labelOf((p.kind ?? 'ANIMAL') === 'WEED' ? WEED_CATEGORY_LABELS : PEST_TYPE_LABELS, p.type)}</TableCell>
                <TableCell>{p.scientificName ?? '—'}</TableCell>
                <TableCell className="text-right"><PestRowActions pest={p} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
