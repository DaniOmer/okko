import { BrevoEmailNotificationSender } from './brevo-email-notification-sender';

describe('BrevoEmailNotificationSender', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD, BREVO_API_KEY: 'k', BREVO_SENDER: 'no-reply@okko.dev' }; });
  afterEach(() => { process.env = OLD; jest.restoreAllMocks(); });

  it('POST Brevo avec api-key et inviteUrl dans le corps', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 201 } as Response);
    const sender = new BrevoEmailNotificationSender();
    await sender.send({ kind: 'invitation', to: 'x@y.z', organizationName: 'Coop', inviteUrl: 'http://app/invite/tok', expiresAt: new Date('2026-07-20') });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init!.headers as Record<string, string>)['api-key']).toBe('k');
    expect(init!.body as string).toContain('http://app/invite/tok');
  });

  it('POST Brevo avec le confirmUrl pour une confirmation d\'email', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 201 } as Response);
    const sender = new BrevoEmailNotificationSender();
    await sender.send({ kind: 'email_confirmation', to: 'x@y.z', confirmUrl: 'http://app/confirm/tok', expiresAt: new Date('2026-07-20') });
    const [, init] = fetchMock.mock.calls[0];
    expect(init!.body as string).toContain('http://app/confirm/tok');
    expect(init!.body as string).toContain('Confirmez votre inscription');
  });

  it('réponse non-ok → throw', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response);
    const sender = new BrevoEmailNotificationSender();
    await expect(sender.send({ kind: 'invitation', to: 'x@y.z', organizationName: 'Coop', inviteUrl: 'u', expiresAt: new Date() })).rejects.toThrow();
  });
});
