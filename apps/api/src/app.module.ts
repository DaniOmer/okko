import { Module } from '@nestjs/common';
import { CropModule } from './crop.module';

@Module({ imports: [CropModule] })
export class AppModule {}
