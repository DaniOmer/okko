'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { unarchiveCrop } from '../../lib/api';

export function UnarchiveButton({ cropId }: { cropId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await unarchiveCrop(cropId);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={handleClick}>
      Désarchiver
    </Button>
  );
}
