import { BadRequestException, Body, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadService } from './upload.service';

/** Folders the app uploads to; anything else lands in "chat". */
const FOLDERS = new Set(['chat', 'chat/voice', 'receipts']);
/** Images, video, voice notes and PDFs: what the support chat and the payment receipts need. */
const ALLOWED = /^(image\/(png|jpe?g|webp|gif|heic|heif)|video\/(mp4|webm|quicktime)|audio\/(webm|ogg|mpeg|mp4|wav|x-m4a|aac)|application\/pdf)$/;
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * File uploads for the support chat and the client portal. Requires a session (staff, Syncro team
 * or a client of the portal): before, anyone on the internet could store files in the bucket.
 */
@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES, files: 1 } }))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('folder') folder: string, @Req() req: any) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (!ALLOWED.test(file.mimetype)) throw new BadRequestException('Tipo de archivo no permitido. Sube una imagen, un video, un audio o un PDF.');
    const base = FOLDERS.has(folder) ? folder : 'chat';
    // Each business (or the Syncro team) gets its own prefix in the bucket
    const owner = req.user?.businessId ?? (req.user?.role === 'syncropos' ? 'syncro' : 'other');
    const url = await this.uploadService.uploadFile(file, `${base}/${owner}`);
    return { url };
  }
}
