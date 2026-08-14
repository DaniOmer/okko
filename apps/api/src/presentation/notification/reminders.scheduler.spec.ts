import { RemindersScheduler } from './reminders.scheduler';
import type { RunDueRemindersUseCase } from '../../application/notification/run-due-reminders.use-case';
import type { RunDueStageAdviceUseCase } from '../../application/notification/run-due-stage-advice.use-case';

describe('RemindersScheduler', () => {
  it('handleCron déclenche rappels ET conseils avec le today de l horloge', async () => {
    const calls: string[] = [];
    const runDue = { execute: async (i: { today: string }) => { calls.push(`reminders:${i.today}`); return { campaigns: 1, sent: 1, failed: 0 }; } } as unknown as RunDueRemindersUseCase;
    const runAdvice = { execute: async (i: { today: string }) => { calls.push(`advice:${i.today}`); return { campaigns: 1, sent: 1, failed: 0 }; } } as unknown as RunDueStageAdviceUseCase;
    const clock = { nowIso: () => '2026-08-13T00:00:00.000Z' };
    const sched = new RemindersScheduler(runDue, runAdvice, clock);
    await sched.handleCron();
    expect(calls).toEqual(['reminders:2026-08-13T00:00:00.000Z', 'advice:2026-08-13T00:00:00.000Z']);
  });
});
