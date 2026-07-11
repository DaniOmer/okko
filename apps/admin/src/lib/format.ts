import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return isValid(d) ? format(d, "d MMM yyyy 'à' HH:mm", { locale: fr }) : iso;
}

export function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  return isValid(d) ? format(d, 'd MMM', { locale: fr }) : iso;
}
