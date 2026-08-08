import { listBeneficiaries } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { BeneficiaireCreate } from './BeneficiaireForm.client';
import { BeneficiaireRowActions } from './BeneficiaireRowActions';

const WRITERS = ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT'];

export default async function BeneficiairesPage() {
  const session = getSession();
  const canWrite = session ? WRITERS.includes(session.role) : false;
  const rows = await listBeneficiaries().catch(() => []);
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bénéficiaires</h1>
          <p className="text-sm text-muted-foreground">Les agriculteurs suivis par votre organisation.</p>
        </div>
        {canWrite && <BeneficiaireCreate />}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun bénéficiaire.</p>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Téléphone</TableHead>{canWrite && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.phone ?? '—'}</TableCell>
                {canWrite && <TableCell className="text-right"><BeneficiaireRowActions b={b} /></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
