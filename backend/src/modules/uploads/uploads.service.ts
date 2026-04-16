import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadsService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
    this.bucketName = this.configService.get<string>('AWS_BUCKET_NAME') || '';
  }

  async uploadFile(file: Express.Multer.File, userEmail: string): Promise<string> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // Try S3 upload first
    try {
      const folderPath = `${userEmail}/product_images`;
      const key = `${folderPath}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);
      const region = this.configService.get<string>('AWS_REGION');
      const s3Url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
      
      console.log('S3 upload successful:', s3Url);
      return s3Url;
    } catch (error) {
      console.error('Error uploading to S3, falling back to local storage:', error);
      
      // Fallback to local storage
      const fs = require('fs');
      const path = require('path');
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', userEmail);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Save file locally
      const localFilePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(localFilePath, file.buffer);
      
      // Return local URL (this would need to be served by the backend)
      const localUrl = `${this.configService.get<string>('API_URL') || 'http://localhost:9000'}/uploads/${userEmail}/${fileName}`;
      console.log('Local upload successful:', localUrl);
      return localUrl;
    }
  }
}
