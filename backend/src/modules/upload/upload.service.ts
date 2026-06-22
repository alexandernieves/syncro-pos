import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION')!,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
    this.bucketName = this.configService.get<string>('AWS_BUCKET_NAME')!;
  }

  private async optimizeImage(file: Express.Multer.File): Promise<{ buffer: Buffer; mimetype: string; extension: string }> {
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
      try {
        const sharp = require('sharp');
        const optimizedBuffer = await sharp(file.buffer)
          .resize({ width: 800, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        return {
          buffer: optimizedBuffer,
          mimetype: 'image/webp',
          extension: 'webp',
        };
      } catch (err: any) {
        console.error('[UploadService] Error optimizing image with sharp:', err.message);
      }
    }
    const ext = file.originalname.split('.').pop() || '';
    return { buffer: file.buffer, mimetype: file.mimetype, extension: ext };
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'chat') {
    const { buffer, mimetype, extension } = await this.optimizeImage(file);
    
    // Generate fileName with correct extension
    const lastDotIdx = file.originalname.lastIndexOf('.');
    const baseName = lastDotIdx !== -1 ? file.originalname.substring(0, lastDotIdx) : file.originalname;
    const fileName = extension === 'webp'
      ? `${uuidv4()}-${baseName}.webp`
      : `${uuidv4()}-${file.originalname}`;
    
    const key = `${folder}/${fileName}`;

    // Force correct mimetype for voice notes
    const contentType = fileName.endsWith('.webm') ? 'audio/webm' : mimetype;

    try {
      console.log(`🚀 S3 Upload: ${key}`);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Explicitly NO ACL here to avoid AccessControlListNotSupported
      });

      await this.s3Client.send(command);
      console.log('✅ S3 Success');
      
      const cdnUrl = this.configService.get<string>('CDN_URL');
      if (cdnUrl) {
        return `${cdnUrl.replace(/\/$/, '')}/${key}`;
      }
      return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
    } catch (error: any) {
      console.error('❌ S3 Fatal Error:', error.message);
      // Fallback local como red de seguridad
      const uploadDir = path.join(process.cwd(), 'uploads', folder);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, fileName), buffer);
      const serverUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 9000}`;
      return `${serverUrl}/uploads/${folder}/${fileName}`;
    }
  }
}
