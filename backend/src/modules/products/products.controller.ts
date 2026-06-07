import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseInterceptors, UploadedFile, UseGuards, Request } from '@nestjs/common';
import { ProductsService } from './products.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from '../uploads/uploads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly uploadsService: UploadsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any
  ) {
    if (file) {
      const email = req.user.email;
      body.image = await this.uploadsService.uploadFile(file, email);
    }
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.productsService.create({ ...body, businessId }, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('quick-create')
  async quickCreate(@Body() data: any, @Request() req: any) {
    const businessId = req.user?.businessId;
    return this.productsService.quickCreate({ ...data, businessId });
  }

  @UseGuards(JwtAuthGuard)
  @Get() 
  findAll(@Query('branchId') branchId: string, @Request() req: any) { 
    const businessId = req.user?.businessId;
    return this.productsService.findAll(businessId, branchId); 
  }

  @UseGuards(JwtAuthGuard)
  @Get('search-images')
  async searchImages(@Query('q') q: string) {
    if (!q) {
      return [];
    }
    try {
      console.log('[ProductsController] Image search query:', q);
      const mainUrl = `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
      const mainRes = await fetch(mainUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      const mainHtml = await mainRes.text();
      
      let vqd: string | null = null;
      const vqdMatch = mainHtml.match(/vqd=([a-zA-Z0-9-]+)/) || mainHtml.match(/'vqd':\s*'([^']+)'/) || mainHtml.match(/"vqd":\s*"([^"]+)"/);
      if (vqdMatch) {
        vqd = vqdMatch[1];
      }
      
      if (!vqd) {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const htmlRes = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        const responseHtml = await htmlRes.text();
        const vqdFormMatch = responseHtml.match(/name="vqd" value="([^"]+)"/);
        if (vqdFormMatch) {
          vqd = vqdFormMatch[1];
        }
      }
      
      if (!vqd) {
        throw new Error("Could not extract VQD token for image search");
      }
      
      const searchImagesUrl = `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,`;
      const imagesRes = await fetch(searchImagesUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://duckduckgo.com/',
        }
      });
      
      if (!imagesRes.ok) {
        throw new Error(`DuckDuckGo image request failed: ${imagesRes.statusText}`);
      }
      
      const data = await imagesRes.json();
      const results = (data.results || []).slice(0, 12).map((item: any) => ({
        image: item.image,
        thumbnail: item.thumbnail,
        title: item.title,
        width: item.width,
        height: item.height
      }));
      
      return results;
    } catch (error) {
      console.error("Error during image search:", error);
      return [];
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload-by-url')
  async uploadByUrl(@Body() body: { imageUrl: string }, @Request() req: any) {
    const email = req.user.email;
    const url = body.imageUrl;
    const s3Url = await this.uploadsService.uploadFromUrl(url, email);
    return { url: s3Url };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id') findOne(@Param('id') id: string, @Request() req: any) { 
    const businessId = req.user?.businessId;
    return this.productsService.findOne(id, businessId); 
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/stats') getStats(@Param('id') id: string, @Request() req: any) { 
    const businessId = req.user?.businessId;
    return this.productsService.getStats(id, businessId); 
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any
  ) {
    if (file) {
      const email = req.user.email;
      body.image = await this.uploadsService.uploadFile(file, email);
    }
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    return this.productsService.update(id, body, userId, businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id') async remove(@Param('id') id: string, @Request() req: any) { 
    console.log('[ProductsController] DELETE request received for ID:', id);
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.businessId;
    const result = await this.productsService.remove(id, userId, businessId);
    return { 
      message: 'Product deletion processed', 
      id, 
      verification: 'CODE_V2_ACTIVE',
      result 
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('validate-barcode/:barcode') validateBarcode(@Param('barcode') barcode: string, @Request() req: any) {
    const businessId = req.user?.businessId;
    return this.productsService.validateBarcode(barcode, businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('waitlist/all') getWaitlist(@Request() req: any) {
    const businessId = req.user?.businessId;
    return this.productsService.getWaitlist(businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('waitlist')
  addToWaitlist(@Body() body: any, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    
    return this.productsService.addToWaitlist({
      name: body.name,
      price: Number(body.price),
      stock: Number(body.stock),
      barcode: body.barcode,
      branchId: body.branchId,
      userId: userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('waitlist/:id') removeFromWaitlist(@Param('id') id: string) {
    return this.productsService.removeFromWaitlist(id);
  }}
