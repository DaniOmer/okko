'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCrop, setCropImages } from '@/lib/actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ImageGalleryUploader } from '@/components/ImageGalleryUploader';
import type { ImageRef } from '@/lib/api';
import { CYCLE_TYPE_LABELS, USAGE_CATEGORY_LABELS } from '@/lib/labels';

export default function NewCropPage() {
  const router = useRouter();
  const [fr, setFr] = useState('');
  const [scientificName, setSci] = useState('');
  const [family, setFamily] = useState('');
  const [cycleType, setCycle] = useState('SEASONAL_ANNUAL');
  const [usageCategory, setUsageCategory] = useState('');
  const [images, setImages] = useState<ImageRef[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const crop = await createCrop({ commonNames: { fr }, scientificName, family, cycleType, usageCategory: usageCategory || undefined });
      if (images.length) await setCropImages(crop.id, images.map((i) => ({ key: i.key, caption: i.caption })));
      router.refresh();
      router.push('/crops');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
  }

  return (
    <main className="p-8 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle culture</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMsg && <p className="mb-4 text-destructive">{errorMsg}</p>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="crop-fr">Nom (fr)</Label>
              <Input id="crop-fr" placeholder="Nom (fr)" value={fr} onChange={(e) => setFr(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="crop-sci">Nom scientifique</Label>
              <Input id="crop-sci" placeholder="Nom scientifique" value={scientificName} onChange={(e) => setSci(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="crop-family">Famille</Label>
              <Input id="crop-family" placeholder="Famille" value={family} onChange={(e) => setFamily(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Type de cycle</Label>
              <Select value={cycleType} onValueChange={setCycle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CYCLE_TYPE_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Catégorie d'usage</Label>
              <Select value={usageCategory} onValueChange={setUsageCategory}>
                <SelectTrigger><SelectValue placeholder="— choisir —" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(USAGE_CATEGORY_LABELS).map(([code, fr]) => <SelectItem key={code} value={code}>{fr}</SelectItem>)}
                </SelectContent>
              </Select>
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
