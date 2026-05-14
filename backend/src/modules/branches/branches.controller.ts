import { Controller, Get, Post, Body, Param, Put, Delete, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BranchesService } from './branches.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post() create(@Body() data: any) { return this.branchesService.create(data); }
  @Get() findAll() { return this.branchesService.findAll(); }
  @Get('main') findMain() { return this.branchesService.findMain(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.branchesService.findOne(id); }
  @Put(':id') update(@Param('id') id: string, @Body() data: any) { return this.branchesService.update(id, data); }
  @Put(':id/set-main') setMain(@Param('id') id: string) { return this.branchesService.setMain(id); }
  @Delete(':id') remove(@Param('id') id: string) { return this.branchesService.remove(id); }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/wipe')
  wipeData(@Param('id') id: string, @Body('password') password: string, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.branchesService.wipeData(id, userId, password);
  }
}
