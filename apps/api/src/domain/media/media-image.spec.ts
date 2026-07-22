import { MediaImage } from './media-image';

describe('MediaImage — category', () => {
  it('round-trip JSON préserve la catégorie', () => {
    const img = MediaImage.fromJSON({ key: 'k1', caption: 'adulte', category: 'ADULT' });
    expect(img.category).toBe('ADULT');
    expect(img.toJSON()).toEqual({ key: 'k1', caption: 'adulte', category: 'ADULT' });
  });
  it('omet category si absente', () => {
    expect(MediaImage.fromJSON({ key: 'k2' }).toJSON()).toEqual({ key: 'k2' });
  });
});
