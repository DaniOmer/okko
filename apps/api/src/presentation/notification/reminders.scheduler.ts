import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RunDueRemindersUseCase } from '../../application/notification/run-due-reminders.use-case';
import { CLOCK, Clock } from '../../application/shared/clock';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger('RemindersScheduler');
  private running = false;

  constructor(
    private readonly runDue: RunDueRemindersUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Cron(process.env.REMINDERS_CRON ?? '0 5 * * *')
  async handleCron(): Promise<void> {
    if (this.running) { this.logger.warn('Passage de rappels deja en cours, saut.'); return; }
    this.running = true;
    try {
      const r = await this.runDue.execute({ today: this.clock.nowIso() });
      this.logger.log(`Rappels: ${r.campaigns} campagnes, ${r.sent} envois, ${r.failed} echecs.`);
    } finally {
      this.running = false;
    }
  }
}
