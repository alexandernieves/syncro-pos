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
    return this.productsService.create(body);
  }

  @Post('quick-create')
  async quickCreate(@Body() data: { name: string, price: number, stock: number, barcodes: string[], branchId?: string }) {
    return this.productsService.quickCreate(data);
  }

  @Get() findAll() { 
    return this.productsService.findAll(); 
  }

  @Get(':id') findOne(@Param('id') id: string) { 
    return this.productsService.findOne(id); 
  }

  @Get(':id/stats') getStats(@Param('id') id: string) { 
    return this.productsService.getStats(id); 
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
    return this.productsService.update(id, body);
  }

  @Delete(':id') async remove(@Param('id') id: string) { 
    console.log('[ProductsController] DELETE request received for ID:', id);
    const result = await this.productsService.remove(id);
    return { 
      message: 'Product deletion processed', 
      id, 
      verification: 'CODE_V2_ACTIVE',
      result 
    };
  }

  @Get('validate-barcode/:barcode') validateBarcode(@Param('barcode') barcode: string) {
    return this.productsService.validateBarcode(barcode);
  }

  @UseGuards(JwtAuthGuard)
  @Get('waitlist/all') getWaitlist() {
    return this.productsService.getWaitlist();
  }

  @UseGuards(JwtAuthGuard)
  @Post('waitlist') addToWaitlist(@Body() body: any, @Request() req: any) {
    return this.productsService.addToWaitlist({
      ...body,
      userId: req.user.sub, // Assuming sub is the userId from JWT
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('waitlist/:id') removeFromWaitlist(@Param('id') id: string) {
    return this.productsService.removeFromWaitlist(id);
  }
}
