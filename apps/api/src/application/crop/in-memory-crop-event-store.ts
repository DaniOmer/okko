import { CropEventStore, StoredCropEvent, ConcurrencyError } from './crop-event-store';
import { CropEvent } from '../../domain/crop/crop-event';

export class InMemoryCropEventStore implements CropEventStore {
  private streams = new Map<string, StoredCropEvent[]>();

  async append(streamId: string, expectedSequence: number, entries: { event: CropEvent; actor: string; at: string }[]): Promise<void> {
    const cur = this.streams.get(streamId) ?? [];
    if (cur.length !== expectedSequence) throw new ConcurrencyError(expectedSequence, cur.length);
    const appended = entries.map((e, i) => ({ streamId, sequence: cur.length + i + 1, event: e.event, actor: e.actor, at: e.at }));
    this.streams.set(streamId, [...cur, ...appended]);
  }

  async load(streamId: string): Promise<StoredCropEvent[]> {
    return [...(this.streams.get(streamId) ?? [])];
  }
}
