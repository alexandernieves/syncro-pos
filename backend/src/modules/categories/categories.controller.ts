import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.categoriesService.create({ ...body, businessId });
  }

  @Get()
  findAll(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.categoriesService.findAll(businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.categoriesService.findOne(id, businessId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.categoriesService.update(id, body, businessId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.categoriesService.remove(id, businessId);
  }
}
