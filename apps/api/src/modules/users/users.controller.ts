import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChangePasswordSchema, UpdateProfileSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, ResponseMessage } from '../../common/decorators.js';
import { UsersService } from './users.service.js';

class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthUserContext) {
    return this.users.me(user.id);
  }

  @Patch()
  @ResponseMessage('Profile updated')
  update(@CurrentUser() user: AuthUserContext, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('password')
  @HttpCode(200)
  @ResponseMessage('Password changed. Please sign in again on other devices.')
  async changePassword(@CurrentUser() user: AuthUserContext, @Body() dto: ChangePasswordDto) {
    await this.users.changePassword(user.id, dto);
    return null;
  }
}
