import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post() create(@Body() body: any) { return this.categoriesService.create(body); }
  @Get() findAll() { return this.categoriesService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.categoriesService.findOne(id); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.categoriesService.update(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.categoriesService.remove(id); }
}
