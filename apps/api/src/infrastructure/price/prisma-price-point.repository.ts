import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PricePoint as PrismaPrice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricePointRepository } from '../../application/price/price-point.repository';
import { PricePointSnapshot } from '../../domain/price/price-point';

@Injectable()
export class PrismaPricePointRepository implements PricePointRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(p: PricePointSnapshot): Promise<void> {
    await this.prisma.pricePoint.upsert({ where: { id: p.id }, create: this.toRow(p), update: this.toRow(p) });
  }

  async listByCrop(cropId: string): Promise<PricePointSnapshot[]> {
    const rows = await this.prisma.pricePoint.findMany({ where: { cropId }, orderBy: { date: 'desc' } });
    return rows.map((r) => this.toSnapshot(r));
  }

  private toRow(p: PricePointSnapshot): Prisma.PricePointCreateInput {
    return {
      id: p.id, cropId: p.cropId, market: p.market, date: p.date,
      price: p.price, unit: p.unit, currency: p.currency,
    };
  }

  private toSnapshot(row: PrismaPrice): PricePointSnapshot {
    return {
      id: row.id, cropId: row.cropId, market: row.market, date: row.date,
      price: row.price, unit: row.unit, currency: row.currency,
    };
  }
}
