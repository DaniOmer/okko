'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPest } from '@/lib/actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PEST_TYPE_LABELS, PEST_PHOTO_CATEGORY_LABELS, WEED_CATEGORY_LABELS } from '@/lib/labels';
import { ImageGalleryUploader } from '@/components/ImageGalleryUploader';
import type { ImageRef } from '@/lib/api';

export default function NewPestPage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [kind, setKind] = useState('ANIMAL');
  const [type, setType] = useState('INSECT');
  const categoryLabels = kind === 'WEED' ? WEED_CATEGORY_LABELS : PEST_TYPE_LABELS;

  function onKindChange(k: string) {
    setKind(k);
    const first = Object.keys(k === 'WEED' ? WEED_CATEGORY_LABELS : PEST_TYPE_LABELS)[0];
    setType(first);
  }
  const [scientificName, setSci] = useState('');
  const [family, setFamily] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<ImageRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createPest({ name: { fr }, type, kind, scientificName: scientificName || undefined, family: family || undefined, description: description ? { fr: description } : undefined, images: images.map((i) => ({ key: i.key, caption: i.caption, category: i.category })) });
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
          <CardTitle>Nouveau bioagresseur</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-destructive">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="pest-fr">Nom (fr)</Label>
              <Input id="pest-fr" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Type de bioagresseur</Label>
              <Select value={kind} onValueChange={onKindChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANIMAL">Ravageur</SelectItem>
                  <SelectItem value="WEED">Adventice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pest-sci">Nom scientifique (optionnel)</Label>
              <Input id="pest-sci" placeholder="Nom scientifique (optionnel)" value={scientificName} onChange={(e) => setSci(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pest-family">Famille taxonomique (optionnel)</Label>
              <Input id="pest-family" placeholder="ex. Noctuidae" value={family} onChange={(e) => setFamily(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pest-desc">Description (optionnel)</Label>
              <textarea id="pest-desc" className="min-h-20 w-full rounded-md border px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Photos (optionnel)</Label>
              <ImageGalleryUploader value={images} onChange={setImages} categories={Object.entries(PEST_PHOTO_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
            </div>
            <Button type="submit">Créer</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
