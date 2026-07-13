import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default function Home() {
  const session = getSession();
  if (!session) redirect('/login');
  if (session.role === 'superadmin') redirect('/crops');
  if (session.role === 'admin') redirect('/membres');
  redirect('/bientot'); // editor
}
