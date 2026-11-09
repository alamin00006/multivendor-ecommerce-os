import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddressSchema, UpdateAddressSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, Public, ResponseMessage } from '../../common/decorators.js';
import { AddressesService } from './addresses.service.js';

class AddressDto extends createZodDto(AddressSchema) {}
class UpdateAddressDto extends createZodDto(UpdateAddressSchema) {}

@ApiTags('geo')
@Public()
@Controller('geo')
export class GeoController {
  constructor(private readonly addresses: AddressesService) {}

  @Get('divisions')
  divisions() {
    return this.addresses.divisions();
  }

  @Get('divisions/:id/districts')
  districts(@Param('id', ParseIntPipe) id: number) {
    return this.addresses.districts(id);
  }

  @Get('districts/:id/areas')
  areas(@Param('id', ParseIntPipe) id: number) {
    return this.addresses.areas(id);
  }
}

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthUserContext) {
    return this.addresses.list(user.id);
  }

  @Post()
  @ResponseMessage('Address saved')
  create(@CurrentUser() user: AuthUserContext, @Body() dto: AddressDto) {
    return this.addresses.create(user.id, dto);
  }

  @Patch(':id')
  @ResponseMessage('Address updated')
  update(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addresses.update(user.id, id, dto);
  }

  @Delete(':id')
  @ResponseMessage('Address removed')
  async remove(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    await this.addresses.remove(user.id, id);
    return null;
  }
}
