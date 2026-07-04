import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IdGenerator } from '../application/crop/add-variety.use-case';

@Injectable()
export class UuidIdGenerator implements IdGenerator {
  next(): string { return randomUUID(); }
}
