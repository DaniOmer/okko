import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RunDueRemindersUseCase } from '../../application/notification/run-due-reminders.use-case';
import { RunDueStageAdviceUseCase } from '../../application/notification/run-due-stage-advice.use-case';
import { CLOCK, Clock } from '../../application/shared/clock';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger('RemindersScheduler');
  private running = false;

  constructor(
    private readonly runDue: RunDueRemindersUseCase,
    private readonly runAdvice: RunDueStageAdviceUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Cron(process.env.REMINDERS_CRON ?? '0 5 * * *')
  async handleCron(): Promise<void> {
    if (this.running) { this.logger.warn('Passage de notifications deja en cours, saut.'); return; }
    this.running = true;
    try {
      const today = this.clock.nowIso();
      const r = await this.runDue.execute({ today });
      this.logger.log(`Rappels: ${r.campaigns} campagnes, ${r.sent} envois, ${r.failed} echecs.`);
      const a = await this.runAdvice.execute({ today });
      this.logger.log(`Conseils: ${a.campaigns} campagnes, ${a.sent} envois, ${a.failed} echecs.`);
    } finally {
      this.running = false;
    }
  }
}
