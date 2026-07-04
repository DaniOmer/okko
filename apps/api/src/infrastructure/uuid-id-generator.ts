import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IdGenerator } from '../application/shared/id-generator';

@Injectable()
export class UuidIdGenerator implements IdGenerator {
  next(): string { return randomUUID(); }
}
