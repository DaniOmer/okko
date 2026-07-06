import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CropEventStore, StoredCropEvent, ConcurrencyError } from '../../application/crop/crop-event-store';
import { CropEvent } from '../../domain/crop/crop-event';

@Injectable()
export class PrismaCropEventStore implements CropEventStore {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    streamId: string,
    expectedSequence: number,
    entries: { event: CropEvent; actor: string; at: string }[],
  ): Promise<void> {
    const count = await this.prisma.cropEvent.count({ where: { streamId } });
    if (count !== expectedSequence) throw new ConcurrencyError(expectedSequence, count);
    try {
      await this.prisma.cropEvent.createMany({
        data: entries.map((e, i) => ({
          streamId,
          sequence: count + i + 1,
          type: e.event.type,
          payload: e.event as unknown as Prisma.InputJsonValue,
          actor: e.actor,
          at: new Date(e.at),
        })),
      });
    } catch (err) {
      // violation d'unicité (streamId, sequence) = conflit concurrent
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConcurrencyError(expectedSequence, count);
      }
      throw err;
    }
  }

  async load(streamId: string): Promise<StoredCropEvent[]> {
    const rows = await this.prisma.cropEvent.findMany({
      where: { streamId },
      orderBy: { sequence: 'asc' },
    });
    return rows.map((r) => ({
      streamId: r.streamId,
      sequence: r.sequence,
      event: r.payload as unknown as CropEvent,
      actor: r.actor,
      at: r.at.toISOString(),
    }));
  }
}
