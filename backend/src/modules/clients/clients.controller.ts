import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.create({ ...body, businessId });
  }

  @Get()
  findAll(@Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.findAll(businessId);
  }

  @Get('search')
  search(@Query('q') q: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.searchByDocument(q || '', businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.findOne(id, businessId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.update(id, body, businessId);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.update(id, body, businessId);
  }

  @Post(':id/payment')
  registerPayment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.registerPayment(id, body, businessId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    const businessId = req.user.businessId;
    return this.clientsService.remove(id, businessId);
  }
}
