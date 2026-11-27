import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityListQuerySchema, AdminUpdateUserSchema, CreateStaffSchema, UpdateStaffSchema, UserListQuerySchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, ResponseMessage, Roles } from '../../common/decorators.js';
import { AdminService } from './admin.service.js';
import { StaffService } from './staff.service.js';

class UserListQueryDto extends createZodDto(UserListQuerySchema) {}
class AdminUpdateUserDto extends createZodDto(AdminUpdateUserSchema) {}
class CreateStaffDto extends createZodDto(CreateStaffSchema) {}
class UpdateStaffDto extends createZodDto(UpdateStaffSchema) {}
class ActivityListQueryDto extends createZodDto(ActivityListQuerySchema) {}

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

/** Staff accounts and the activity log: full-access admins only (enforced by AdminAccessGuard). */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('staff')
  list() {
    return this.staff.list();
  }

  @Post('staff')
  @ResponseMessage('Staff account created')
  create(@Body() dto: CreateStaffDto) {
    return this.staff.create(dto);
  }

  @Patch('staff/:id')
  @ResponseMessage('Staff account updated')
  update(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staff.update(user.id, id, dto);
  }

  @Get('activity')
  activity(@Query() query: ActivityListQueryDto) {
    return this.staff.activity(query);
  }
}
