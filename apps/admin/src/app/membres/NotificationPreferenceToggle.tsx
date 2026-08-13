'use client';
import { useState } from 'react';
import { setNotificationPreference } from '@/lib/suivi-actions';

export function NotificationPreferenceToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle(next: boolean) {
    setEnabled(next); setBusy(true);
    try { await setNotificationPreference(next); } catch { setEnabled(!next); }
    finally { setBusy(false); }
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
      Recevoir les rappels de suivi par email
    </label>
  );
}
