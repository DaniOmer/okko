import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /logout', () => {
  it('efface le cookie de session et redirige vers /login?expired=1', async () => {
    const res = await GET(new Request('http://localhost:3000/logout'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname + loc.search).toBe('/login?expired=1');
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('okko_session=;');
  });
});
