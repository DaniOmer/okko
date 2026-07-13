import { Module } from '@nestjs/common';
import { CropModule } from './crop.module';
import { AuthModule } from './auth.module';

@Module({ imports: [AuthModule, CropModule] })
export class AppModule {}
