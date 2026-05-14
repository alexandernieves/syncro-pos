import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post() create(@Body() body: any) { return this.clientsService.create(body); }
  @Get() findAll() { return this.clientsService.findAll(); }
  @Get('search') search(@Query('q') q: string) { return this.clientsService.searchByDocument(q || ''); }
  @Get(':id') findOne(@Param('id') id: string) { return this.clientsService.findOne(id); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.clientsService.update(id, body); }
  @Patch(':id') patch(@Param('id') id: string, @Body() body: any) { return this.clientsService.update(id, body); }
  @Post(':id/payment') registerPayment(@Param('id') id: string, @Body() body: any) {
    return this.clientsService.registerPayment(id, body);
  }
  @Delete(':id') remove(@Param('id') id: string) { return this.clientsService.remove(id); }
}
