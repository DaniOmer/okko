'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createZone } from '@/lib/actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImageGalleryUploader } from '@/components/ImageGalleryUploader';
import type { ImageRef } from '@/lib/api';

export default function NewZonePage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [country, setCountry] = useState('');
  const [koppen, setKoppen] = useState('');
  const [images, setImages] = useState<ImageRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createZone({ name: { fr }, country, koppen: koppen || undefined, images: images.map((i) => ({ key: i.key, caption: i.caption })) });
      router.refresh();
      router.push('/zones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <main className="p-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle zone</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-destructive">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="zone-fr">Nom (fr)</Label>
              <Input id="zone-fr" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="zone-country">Pays</Label>
              <Input id="zone-country" placeholder="Pays (ex. BJ)" value={country} onChange={(e) => setCountry(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="zone-koppen">Köppen (optionnel)</Label>
              <Input id="zone-koppen" placeholder="Köppen (optionnel)" value={koppen} onChange={(e) => setKoppen(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Photos (optionnel)</Label>
              <ImageGalleryUploader value={images} onChange={setImages} />
            </div>
            <Button type="submit">Créer</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
