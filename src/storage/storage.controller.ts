import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { StorageService } from './storage.service';
import { SignedUploadUrlDto } from './dto/signed-upload-url.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('signed-upload-url')
  getSignedUploadUrl(
    @CurrentUser() user: { id: string },
    @Body() dto: SignedUploadUrlDto,
  ) {
    return this.storageService.signedUploadUrl({
      folder: dto.folder,
      fileName: dto.fileName,
      contentType: dto.contentType,
      userId: user.id,
    });
  }
}
