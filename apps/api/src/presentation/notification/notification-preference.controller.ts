import { Controller, Get, Patch, Body, UseGuards, Inject } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { NOTIFICATION_PREFERENCE_REPOSITORY, NotificationPreferenceRepository } from '../../application/notification/notification-preference.repository';

@Controller('me/notification-preferences')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationPreferenceController {
  constructor(@Inject(NOTIFICATION_PREFERENCE_REPOSITORY) private readonly prefs: NotificationPreferenceRepository) {}

  @Get() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async get(@CurrentUser() user: AuthUser) {
    const pref = await this.prefs.findByUserId(user.sub);
    return { remindersEnabled: pref ? pref.remindersEnabled : true };
  }

  @Patch() @Roles('ORG_ADMIN', 'AGRONOMIST', 'FIELD_AGENT', 'VIEWER')
  async patch(@CurrentUser() user: AuthUser, @Body() body: { remindersEnabled: boolean }) {
    await this.prefs.upsert(user.sub, body.remindersEnabled === true);
    return { remindersEnabled: body.remindersEnabled === true };
  }
}
