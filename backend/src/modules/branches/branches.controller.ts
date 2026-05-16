import { Controller, Get, Post, Body, Param, Put, Delete, Request, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BranchesService } from './branches.service';

@Controller('branches')
@UseGuards(AuthGuard('jwt'))
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post() 
  create(@Body() data: any, @Request() req: any) { 
    if (!req.user) {
      throw new UnauthorizedException('No se encontró información de usuario en la petición');
    }
    const businessId = req.user.businessId;
    return this.branchesService.create({ ...data, businessId }); 
  }

  @Get() 
  findAll(@Request() req: any) { 
    const businessId = req.user.businessId;
    return this.branchesService.findAll(businessId); 
  }

  @Get('main') 
  findMain(@Request() req: any) { 
    const businessId = req.user.businessId;
    return this.branchesService.findMain(businessId); 
  }

  @Get(':id') 
  findOne(@Param('id') id: string, @Request() req: any) { 
    const businessId = req.user.businessId;
    return this.branchesService.findOne(id, businessId); 
  }

  @Put(':id') 
  update(@Param('id') id: string, @Body() data: any, @Request() req: any) { 
    const businessId = req.user.businessId;
    return this.branchesService.update(id, data, businessId); 
  }

  @Put(':id/set-main') 
  setMain(@Param('id') id: string, @Request() req: any) { 
    const businessId = req.user.businessId;
    return this.branchesService.setMain(id, businessId); 
  }

  @Delete(':id') 
  remove(@Param('id') id: string, @Request() req: any) { 
    const businessId = req.user.businessId;
    return this.branchesService.remove(id, businessId); 
  }

  @Post(':id/wipe')
  wipeData(@Param('id') id: string, @Body('password') password: string, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user.businessId;
    return this.branchesService.wipeData(id, userId, password, businessId);
  }
}
