import { Module } from '@nestjs/common';
import { CropModule } from './crop.module';
import { AuthModule } from './auth.module';
import { SuiviModule } from './suivi.module';

@Module({ imports: [AuthModule, CropModule, SuiviModule] })
export class AppModule {}
