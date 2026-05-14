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

  async uploadFile(file: Express.Multer.File, folder: string = 'chat') {
    const fileName = `${uuidv4()}-${file.originalname}`;
    const key = `${folder}/${fileName}`;

    // Force correct mimetype for voice notes
    const contentType = file.originalname.endsWith('.webm') ? 'audio/webm' : file.mimetype;

    try {
      console.log(`🚀 S3 Upload: ${key}`);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.originalname.endsWith('.webm') ? 'audio/webm' : file.mimetype,
        // Explicitly NO ACL here to avoid AccessControlListNotSupported
      });

      await this.s3Client.send(command);
      console.log('✅ S3 Success');
      
      return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${key}`;
    } catch (error: any) {
      console.error('❌ S3 Fatal Error:', error.message);
      // Fallback local como red de seguridad
      const uploadDir = path.join(process.cwd(), 'uploads', folder);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
      const serverUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 9000}`;
      return `${serverUrl}/uploads/${folder}/${fileName}`;
    }
  }
}
