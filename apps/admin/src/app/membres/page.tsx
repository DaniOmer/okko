import { apiListInvitations, type Invitation } from '@/lib/api';
import { getSession } from '@/lib/session';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { InviteForm } from './InviteForm';
import { RevokeButton } from './RevokeButton';
import { getNotificationPreference } from '@/lib/suivi-actions';
import { NotificationPreferenceToggle } from './NotificationPreferenceToggle';

const STATUS_LABELS: Record<Invitation['status'], string> = {
  pending: 'En attente', accepted: 'Acceptée', expired: 'Expirée', revoked: 'Révoquée',
};

const ROLE_LABELS: Record<string, string> = {
  editor: 'Éditeur', ORG_ADMIN: 'Admin', AGRONOMIST: 'Agronome', FIELD_AGENT: 'Agent de terrain', VIEWER: 'Observateur',
};
const ROLE_OPTIONS_BY_INVITER: Record<string, string[]> = {
  admin: ['editor'],
  ORG_ADMIN: ['ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER'],
};

export default async function MembresPage() {
  const session = getSession();
  const invitations = await apiListInvitations();
  const pref = await getNotificationPreference().catch(() => ({ remindersEnabled: true }));
  const canInvite = session ? session.role in ROLE_OPTIONS_BY_INVITER : false;
  const roleOptions = session ? (ROLE_OPTIONS_BY_INVITER[session.role] ?? []).map((v) => ({ value: v, label: ROLE_LABELS[v] })) : [];
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Membres</h1>
        <p className="text-sm text-muted-foreground">Invitez des collaborateurs et gérez leurs invitations.</p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Mes préférences</h2>
        <NotificationPreferenceToggle initial={pref.remindersEnabled} />
      </div>

      {canInvite && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Inviter un collaborateur</h2>
          <InviteForm roleOptions={roleOptions} />
        </div>
      )}

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
