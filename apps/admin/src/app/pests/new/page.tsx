'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPest } from '@/lib/actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PEST_TYPE_LABELS } from '@/lib/labels';
import { ImageGalleryUploader } from '@/components/ImageGalleryUploader';
import type { ImageRef } from '@/lib/api';

export default function NewPestPage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [type, setType] = useState('INSECT');
  const [scientificName, setSci] = useState('');
  const [images, setImages] = useState<ImageRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createPest({ name: { fr }, type, scientificName: scientificName || undefined, images: images.map((i) => ({ key: i.key, caption: i.caption })) });
      router.refresh();
      router.push('/pests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <main className="p-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Nouveau ravageur / maladie</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-destructive">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="pest-fr">Nom (fr)</Label>
              <Input id="pest-fr" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PEST_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pest-sci">Nom scientifique (optionnel)</Label>
              <Input id="pest-sci" placeholder="Nom scientifique (optionnel)" value={scientificName} onChange={(e) => setSci(e.target.value)} />
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
