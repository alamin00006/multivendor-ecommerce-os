import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminUpdateUserSchema, UserListQuerySchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, ResponseMessage, Roles } from '../../common/decorators.js';
import { AdminService } from './admin.service.js';

class UserListQueryDto extends createZodDto(UserListQuerySchema) {}
class AdminUpdateUserDto extends createZodDto(AdminUpdateUserSchema) {}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  users(@Query() query: UserListQueryDto) {
    return this.admin.users(query);
  }

  @Patch('users/:id')
  @ResponseMessage('User updated')
  updateUser(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.admin.updateUser(user.id, id, dto);
  }
}
