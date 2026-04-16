import { Controller, Get, Post, Body, Param, Delete, UseGuards, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UserRole } from './user.schema';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  async create(@Body() createUserDto: Partial<User>) {
    return this.usersService.create(createUserDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    return this.usersService.update(id, updateData);
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    return this.usersService.findOneByEmail(email);
  }

  @Patch('email/:email')
  async updateByEmail(@Param('email') email: string, @Body() updateData: any) {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return this.usersService.update(user.id, updateData);
  }
}
