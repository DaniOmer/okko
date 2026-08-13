'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { notifyCampaignReminder } from '@/lib/suivi-actions';

const SKIP_MSG: Record<string, string> = {
  already_sent: "Rappel déjà envoyé aujourd'hui.",
  no_due_items: 'Aucune échéance due pour le moment.',
  no_recipients: 'Aucun destinataire éligible.',
};

export function SendReminderButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true); setMsg(null);
    try {
      const r = await notifyCampaignReminder(campaignId);
      setMsg(r.sent > 0 ? `Rappel envoyé à ${r.sent} destinataire(s).` : (SKIP_MSG[r.skipped ?? ''] ?? 'Rien à envoyer.'));
    } catch { setMsg("Échec de l'envoi."); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={run}>{busy ? 'Envoi…' : 'Envoyer un rappel'}</Button>
    </div>
  );
}
