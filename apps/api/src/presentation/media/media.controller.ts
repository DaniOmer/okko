import { BadRequestException, Controller, Inject, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { STORAGE_PORT, StoragePort } from '../../application/media/storage.port';
import { UploadImageUseCase, UnsupportedImageTypeError, ImageTooLargeError } from '../../application/media/upload-image.use-case';

@Controller('media')
@UseGuards(AuthGuard, RolesGuard)
@Roles('superadmin')
export class MediaController {
  constructor(
    @Inject(UploadImageUseCase) private readonly upload: UploadImageUseCase,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadFile(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant');
    try {
      const { key } = await this.upload.execute({ bytes: file.buffer, contentType: file.mimetype, actor: user.email });
      return { key, url: this.storage.publicUrl(key) };
    } catch (e) {
      if (e instanceof UnsupportedImageTypeError || e instanceof ImageTooLargeError) throw new BadRequestException(e.message);
      throw e;
    }
  }
}
