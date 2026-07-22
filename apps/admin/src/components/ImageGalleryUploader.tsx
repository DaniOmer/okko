'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { uploadImage } from '@/lib/actions';
import type { ImageRef } from '@/lib/api';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 5 * 1024 * 1024;

export function ImageGalleryUploader({ value, onChange, categories }: { value: ImageRef[]; onChange: (v: ImageRef[]) => void; categories?: { value: string; label: string }[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!ACCEPT.includes(file.type)) { setError('Formats acceptés : JPG, PNG, WebP.'); return; }
    if (file.size > MAX) { setError('Image trop lourde (max 5 Mo).'); return; }
    setError(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { key, url } = await uploadImage(fd);
      onChange([...value, { key, url, caption: '' }]);
    } catch { setError("Échec de l'upload."); }
    finally { setBusy(false); }
  }

  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= value.length) return;
    const next = [...value]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  const setCaption = (i: number, caption: string) => onChange(value.map((img, k) => (k === i ? { ...img, caption } : img)));
  const setCategory = (i: number, category: string) => onChange(value.map((img, k) => (k === i ? { ...img, category } : img)));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {value.map((img, i) => (
          <div key={img.key} className="w-32 space-y-1 rounded-md border p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.caption || ''} className="h-20 w-full rounded object-cover" />
            <Input className="h-7 text-xs" placeholder="légende" value={img.caption ?? ''} onChange={(e) => setCaption(i, e.target.value)} />
            {categories && (
              <Select value={img.category ?? ''} onValueChange={(v) => setCategory(i, v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="catégorie" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex justify-between">
              <button type="button" aria-label="Monter" className="text-xs text-muted-foreground" onClick={() => move(i, -1)} disabled={i === 0}>←</button>
              <button type="button" className="text-xs text-destructive" onClick={() => remove(i)}>Supprimer</button>
              <button type="button" aria-label="Descendre" className="text-xs text-muted-foreground" onClick={() => move(i, 1)} disabled={i === value.length - 1}>→</button>
            </div>
          </div>
        ))}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT.join(',')} className="hidden" onChange={onFile} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Envoi…' : '+ Ajouter une image'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
