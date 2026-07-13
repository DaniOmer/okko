import { apiListInvitations, type Invitation } from '@/lib/api';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { InviteForm } from './InviteForm';
import { RevokeButton } from './RevokeButton';

const STATUS_LABELS: Record<Invitation['status'], string> = {
  pending: 'En attente', accepted: 'Acceptée', expired: 'Expirée', revoked: 'Révoquée',
};

export default async function MembresPage() {
  const invitations = await apiListInvitations();
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Membres</h1>
        <p className="text-sm text-muted-foreground">Invitez des collaborateurs (éditeurs) et gérez leurs invitations.</p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Inviter un collaborateur</h2>
        <InviteForm />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Expire le</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Aucune invitation.</TableCell></TableRow>
          )}
          {invitations.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell>{inv.email}</TableCell>
              <TableCell><Badge variant={inv.status === 'pending' ? 'default' : 'secondary'}>{STATUS_LABELS[inv.status]}</Badge></TableCell>
              <TableCell>{new Date(inv.expiresAt).toLocaleDateString('fr-FR')}</TableCell>
              <TableCell className="text-right">{inv.status === 'pending' && <RevokeButton id={inv.id} />}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
