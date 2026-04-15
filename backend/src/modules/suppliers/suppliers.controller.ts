import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post() create(@Body() body: any) { return this.suppliersService.create(body); }
  @Get() findAll() { return this.suppliersService.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.suppliersService.findOne(id); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.suppliersService.update(id, body); }
  @Post('seed') seed() { return this.suppliersService.seed(); }
  @Delete(':id') remove(@Param('id') id: string) { return this.suppliersService.remove(id); }
}
