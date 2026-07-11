'use client';
import { useRouter } from 'next/navigation';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { CropVersion } from '../../../../lib/api';

export function VersionSelectors({ cropId, versions, from, to }: { cropId: string; versions: CropVersion[]; from: number; to: number }) {
  const router = useRouter();
  const go = (nextFrom: number, nextTo: number) => router.push(`/crops/${cropId}/diff?from=${nextFrom}&to=${nextTo}`);
  return (
    <div className="flex items-end gap-4">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">De</div>
        <Select value={String(from)} onValueChange={(v) => go(Number(v), to)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {versions.map((v) => <SelectItem key={v.revision} value={String(v.revision)}>v{v.revision} — {v.publishedBy}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">À</div>
        <Select value={String(to)} onValueChange={(v) => go(from, Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {versions.map((v) => <SelectItem key={v.revision} value={String(v.revision)}>v{v.revision} — {v.publishedBy}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
