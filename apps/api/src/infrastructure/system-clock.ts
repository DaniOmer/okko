import { Injectable } from '@nestjs/common';
import { Clock } from '../application/shared/clock';

@Injectable()
export class SystemClock implements Clock {
  nowIso(): string { return new Date().toISOString(); }
}
