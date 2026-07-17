import { Injectable } from '@nestjs/common';
import { Notification, NotificationPort } from '../../application/notification/notification-port';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class BrevoEmailNotificationSender implements NotificationPort {
  async send(n: Notification): Promise<void> {
    const apiKey = process.env.BREVO_API_KEY;
    const sender = process.env.BREVO_SENDER;
    if (!apiKey || !sender) throw new Error('BREVO_API_KEY / BREVO_SENDER manquant');
    const { subject, html } = this.render(n);
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { email: sender }, to: [{ email: n.to }], subject, htmlContent: html }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}`);
  }
  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  private render(n: Notification): { subject: string; html: string } {
    switch (n.kind) {
      case 'invitation': {
        const subject = `Invitation à rejoindre ${n.organizationName} sur Okko`;
        const html = `<p>Vous êtes invité·e à rejoindre <strong>${this.escapeHtml(n.organizationName)}</strong> sur Okko.</p>`
          + `<p><a href="${this.escapeHtml(n.inviteUrl)}">Accepter l'invitation</a></p>`
          + `<p>Ce lien expire le ${n.expiresAt.toISOString().slice(0, 10)}.</p>`;
        return { subject, html };
      }
      case 'email_confirmation': {
        const subject = 'Confirmez votre inscription sur Okko';
        const html = `<p>Bienvenue sur Okko. Confirmez votre adresse email pour activer votre compte.</p>`
          + `<p><a href="${this.escapeHtml(n.confirmUrl)}">Confirmer mon inscription</a></p>`
          + `<p>Ce lien expire le ${n.expiresAt.toISOString().slice(0, 10)}.</p>`;
        return { subject, html };
      }
    }
  }
}
