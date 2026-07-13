import { BcryptPasswordHasher } from './bcrypt-password-hasher';

describe('BcryptPasswordHasher', () => {
  const hasher = new BcryptPasswordHasher();
  it('hache puis vérifie correctement', async () => {
    const h = await hasher.hash('s3cret');
    expect(h).not.toBe('s3cret');
    expect(await hasher.verify('s3cret', h)).toBe(true);
    expect(await hasher.verify('mauvais', h)).toBe(false);
  });
});
