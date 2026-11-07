import { Controller, Get, Post, Body, Param, Delete, UseGuards, Patch, Request, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { User } from './user.schema';
import { PushCampaignsService } from '../push/push-campaigns.service';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly pushCampaigns: PushCampaignsService,
  ) {}

  @Get()
  async findAll(@Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    return this.usersService.findAll(businessId);
  }

  @Post()
  async create(@Body() createUserDto: Partial<User>, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    const user: any = await this.usersService.create({ ...createUserDto, businessId });
    // Someone new on the team gets a welcome (when they turn notifications on, if not yet)
    if (user?.id) void this.pushCampaigns.automate('welcome_member', { userIds: [user.id] }, {}, `welcome_member:${user.id}`);
    return user;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    return this.usersService.remove(id, businessId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateData: any, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    return this.usersService.update(id, updateData, businessId);
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    return this.usersService.findOneByEmail(email, businessId);
  }

  @Patch('email/:email')
  async updateByEmail(@Param('email') email: string, @Body() updateData: any, @Request() req: any) {
    if (!req.user) throw new UnauthorizedException('No user context');
    const businessId = req.user.businessId;
    const user = await this.usersService.findOneByEmail(email, businessId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return this.usersService.update(user.id, updateData, businessId);
  }
}
