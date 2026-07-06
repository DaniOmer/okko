import { CropEvent } from '../../domain/crop/crop-event';

export const CROP_EVENT_STORE = Symbol('CROP_EVENT_STORE');

export interface StoredCropEvent {
  streamId: string;
  sequence: number;
  event: CropEvent;
  actor: string;
  at: string;
}

export class ConcurrencyError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`Concurrency conflict: expected sequence ${expected}, found ${actual}`);
    this.name = 'ConcurrencyError';
  }
}

export interface CropEventStore {
  // expectedSequence = dernière séquence connue du flux (0 pour un flux neuf).
  append(streamId: string, expectedSequence: number, entries: { event: CropEvent; actor: string; at: string }[]): Promise<void>;
  load(streamId: string): Promise<StoredCropEvent[]>; // ordonné par sequence croissante
}
