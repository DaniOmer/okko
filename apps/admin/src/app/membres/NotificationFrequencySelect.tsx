'use client';
import { useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { setNotificationPreference } from '@/lib/suivi-actions';

const OPTIONS = [
  { value: '1', label: 'Quotidien' },
  { value: '2', label: 'Tous les 2 jours' },
  { value: '3', label: 'Tous les 3 jours' },
  { value: '7', label: 'Hebdomadaire' },
  { value: '0', label: 'Jamais' },
];

export function NotificationFrequencySelect({ initial }: { initial: number }) {
  const [value, setValue] = useState(String(initial));
  const [busy, setBusy] = useState(false);
  async function change(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    try { await setNotificationPreference(Number(next)); } catch { setValue(prev); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={change} disabled={busy}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>{OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Fréquence des rappels de suivi par email.</p>
    </div>
  );
}
