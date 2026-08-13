import { RemindersScheduler } from './reminders.scheduler';
import type { RunDueRemindersUseCase } from '../../application/notification/run-due-reminders.use-case';

describe('RemindersScheduler', () => {
  it('handleCron delègue à RunDueReminders avec le today de l horloge', async () => {
    const calls: { today: string }[] = [];
    const runDue = { execute: async (i: { today: string }) => { calls.push(i); return { campaigns: 1, sent: 1, failed: 0 }; } } as unknown as RunDueRemindersUseCase;
    const clock = { nowIso: () => '2026-08-13T00:00:00.000Z' };
    const sched = new RemindersScheduler(runDue, clock);
    await sched.handleCron();
    expect(calls).toEqual([{ today: '2026-08-13T00:00:00.000Z' }]);
  });
});
