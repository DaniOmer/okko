import Link from 'next/link';
import { listPests } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { labelOf, PEST_TYPE_LABELS } from '@/lib/labels';
import { PestRowActions } from './PestRowActions';

export default async function PestsPage() {
  const pests = await listPests().catch(() => []);
  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ravageurs &amp; maladies</h1>
        <Button asChild>
          <Link href="/pests/new">Nouveau</Link>
        </Button>
      </div>
      {pests.length === 0 ? (
        <div className="rounded border-2 border-dashed p-8 text-center text-muted-foreground">
          Aucun ravageur ou maladie enregistré.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
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
                <TableCell>{labelOf(PEST_TYPE_LABELS, p.type)}</TableCell>
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
