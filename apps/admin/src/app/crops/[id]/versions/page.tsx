import Link from 'next/link';
import { getCropVersions } from '../../../../lib/api';
import { formatDateTime } from '../../../../lib/format';
import { RestoreButton } from './RestoreButton';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function CropVersionsPage({ params }: { params: { id: string } }) {
  const versions = await getCropVersions(params.id).catch(() => []);
  return (
    <main className="p-8 max-w-4xl space-y-6">
      <div className="space-y-1">
        <Link href={`/crops/${params.id}`} className="text-sm text-primary hover:underline">← Retour à la fiche</Link>
        <h1 className="text-2xl font-bold">Versions publiées</h1>
        {versions.length >= 2 && (
          <Link href={`/crops/${params.id}/diff`} className="text-sm text-primary hover:underline">
            Comparer les versions →
          </Link>
        )}
      </div>
      {versions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aucune version publiée.</div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Publiée le</TableHead>
                <TableHead>Par</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v, i) => (
                <TableRow key={v.revision}>
                  <TableCell className="font-medium">
                    v{v.revision}
                    {i === 0 && <Badge variant="secondary" className="ml-2">courante</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(v.publishedAt)}</TableCell>
                  <TableCell>{v.publishedBy}</TableCell>
                  <TableCell className="text-muted-foreground">{v.note ?? '—'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/crops/${params.id}/versions/${v.revision}`}>Voir</Link>
                    </Button>
                    <RestoreButton cropId={params.id} revision={v.revision} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
