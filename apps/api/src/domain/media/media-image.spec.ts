import { MediaImage } from './media-image';
describe('MediaImage', () => {
  it('round-trips key + caption', () => {
    const r = MediaImage.fromJSON(MediaImage.create({ key: 'images/a.jpg', caption: 'Feuille' }).toJSON());
    expect(r.key).toBe('images/a.jpg');
    expect(r.caption).toBe('Feuille');
  });
  it('omet caption si absente', () => {
    expect(MediaImage.create({ key: 'images/b.png' }).toJSON()).toEqual({ key: 'images/b.png' });
  });
});
