import { Controller, Get, Patch, Body, UseGuards, Inject } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { NOTIFICATION_PREFERENCE_REPOSITORY, NotificationPreferenceRepository } from '../../application/notification/notification-preference.repository';

const ALLOWED_FREQUENCIES = new Set([0, 1, 2, 3, 7]);

@Controller('me/notification-preferences')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationPreferenceController {
  constructor(@Inject(NOTIFICATION_PREFERENCE_REPOSITORY) private readonly prefs: NotificationPreferenceRepository) {}

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async get(@CurrentUser() user: AuthUser) {
    const pref = await this.prefs.findByUserId(user.sub);
    return { reminderEveryNDays: pref ? pref.reminderEveryNDays : 1 };
  }

  @Patch() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async patch(@CurrentUser() user: AuthUser, @Body() body: { reminderEveryNDays: number }) {
    const value = ALLOWED_FREQUENCIES.has(body.reminderEveryNDays) ? body.reminderEveryNDays : 1;
    await this.prefs.upsert(user.sub, value);
    return { reminderEveryNDays: value };
  }
}
