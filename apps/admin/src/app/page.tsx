import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { TENANT_ROLES } from '@/lib/jwt';

export default function Home() {
  const session = getSession();
  if (!session) redirect('/login');
  if (session.role === 'superadmin') redirect('/crops');
  if (session.role === 'admin') redirect('/membres');
  if (TENANT_ROLES.includes(session.role)) redirect('/fiches');
  redirect('/bientot'); // editor
}
