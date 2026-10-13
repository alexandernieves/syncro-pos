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

  private async optimizeImage(fileBuffer: Buffer, mimetype: string): Promise<{ buffer: Buffer; mimetype: string; extension: string }> {
    if (mimetype.startsWith('image/') && mimetype !== 'image/gif') {
      try {
        const sharp = require('sharp');
        const optimizedBuffer = await sharp(fileBuffer)
          .resize({ width: 800, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        return {
          buffer: optimizedBuffer,
          mimetype: 'image/webp',
          extension: 'webp',
        };
      } catch (err: any) {
        console.error('[UploadsService] Error optimizing image with sharp:', err.message);
      }
    }
    let ext = 'jpg';
    if (mimetype.includes('png')) ext = 'png';
    else if (mimetype.includes('webp')) ext = 'webp';
    else if (mimetype.includes('gif')) ext = 'gif';
    // Short product videos for Syncro Shop landing pages
    else if (mimetype === 'video/mp4') ext = 'mp4';
    else if (mimetype === 'video/webm') ext = 'webm';
    else if (mimetype === 'video/quicktime') ext = 'mov';
    return { buffer: fileBuffer, mimetype, extension: ext };
  }

  async uploadFile(file: Express.Multer.File, userEmail: string): Promise<string> {
    const { buffer, mimetype, extension } = await this.optimizeImage(file.buffer, file.mimetype);
    const fileName = `${uuidv4()}.${extension}`;
    
    // Try S3 upload first
    try {
      const folderPath = `${userEmail}/product_images`;
      const key = `${folderPath}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      });

      await this.s3Client.send(command);
      const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
      
      const cdnUrl = this.configService.get<string>('CDN_URL');
      if (cdnUrl) {
        return `${cdnUrl.replace(/\/$/, '')}/${key}`;
      }
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
      fs.writeFileSync(localFilePath, buffer);
      
      // Return local URL (this would need to be served by the backend)
      const localUrl = `${this.configService.get<string>('API_URL') || 'http://localhost:9000'}/uploads/${userEmail}/${fileName}`;
      console.log('Local upload successful:', localUrl);
      return localUrl;
    }
  }

  /**
   * Stores any file (images, audio, video, documents) as is, under `folder`.
   * Used for WhatsApp media so the chat keeps every file it sends or receives.
   */
  async uploadBuffer(buffer: Buffer, mimetype: string, folder: string, originalName?: string): Promise<string> {
    const cleanMime = (mimetype || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    const fromName = originalName?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
    const extension = fromName || UploadsService.EXTENSIONS[cleanMime] || cleanMime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin';
    const key = `${folder}/${uuidv4()}.${extension}`;
    try {
      await this.s3Client.send(new PutObjectCommand({ Bucket: this.bucketName, Key: key, Body: buffer, ContentType: cleanMime }));
      const cdnUrl = this.configService.get<string>('CDN_URL');
      if (cdnUrl) return `${cdnUrl.replace(/\/$/, '')}/${key}`;
      const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
      return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
    } catch (error) {
      console.error('Error uploading to S3, falling back to local storage:', error);
      const fs = require('fs');
      const path = require('path');
      const localPath = path.join(process.cwd(), 'uploads', key);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, buffer);
      return `${this.configService.get<string>('API_URL') || 'http://localhost:9000'}/uploads/${key}`;
    }
  }

  /**
   * Photo of an expense or income receipt. Always in S3 (no local fallback, so it never gets
   * lost on the server's disk), under receipts/<business>/<year-month>/, big enough to read.
   */
  async uploadReceipt(buffer: Buffer, mimetype: string, businessId: string): Promise<string> {
    const mime = (mimetype || '').split(';')[0].trim().toLowerCase();
    let body = buffer;
    let type = mime;
    let ext = UploadsService.EXTENSIONS[mime] || 'bin';
    if (mime.startsWith('image/') && mime !== 'image/gif') {
      try {
        const sharp = require('sharp');
        body = await sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        type = 'image/webp';
        ext = 'webp';
      } catch (err: any) {
        console.error('[UploadsService] Could not optimize the receipt, keeping the original:', err.message);
      }
    }
    const month = new Date().toISOString().slice(0, 7);
    const key = `receipts/${businessId}/${month}/${uuidv4()}.${ext}`;
    if (!this.bucketName) throw new Error('El almacenamiento de archivos (AWS S3) no está configurado');
    await this.s3Client.send(new PutObjectCommand({ Bucket: this.bucketName, Key: key, Body: body, ContentType: type }));
    const cdnUrl = this.configService.get<string>('CDN_URL');
    if (cdnUrl) return `${cdnUrl.replace(/\/$/, '')}/${key}`;
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  private static readonly EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/3gpp': '3gp',
    'application/pdf': 'pdf', 'application/msword': 'doc', 'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
  };

  async uploadFromUrl(imageUrl: string, userEmail: string): Promise<string> {
    try {
      console.log('Downloading image from URL:', imageUrl);
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Determine mimetype and extension
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      const { buffer: optimizedBuffer, mimetype, extension } = await this.optimizeImage(buffer, contentType);
      const fileName = `${uuidv4()}.${extension}`;
      const folderPath = `${userEmail}/product_images`;
      const key = `${folderPath}/${fileName}`;

      // Try uploading to S3
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: optimizedBuffer,
          ContentType: mimetype,
        });

        await this.s3Client.send(command);
        const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
        
        const cdnUrl = this.configService.get<string>('CDN_URL');
        if (cdnUrl) {
          return `${cdnUrl.replace(/\/$/, '')}/${key}`;
        }
        const s3Url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
        console.log('S3 download-and-upload successful:', s3Url);
        return s3Url;
      } catch (s3Error) {
        console.error('Error uploading downloaded image to S3, falling back to local storage:', s3Error);
        
        // Local Fallback
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(process.cwd(), 'uploads', userEmail);
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const localFilePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(localFilePath, optimizedBuffer);
        
        const localUrl = `${this.configService.get<string>('API_URL') || 'http://localhost:9000'}/uploads/${userEmail}/${fileName}`;
        console.log('Local fallback upload successful:', localUrl);
        return localUrl;
      }
    } catch (error) {
      console.error('Failed in uploadFromUrl:', error);
      throw error;
    }
  }
}

