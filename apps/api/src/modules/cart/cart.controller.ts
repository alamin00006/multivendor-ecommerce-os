import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddToCartSchema, MergeCartSchema, SelectAllCartSchema, UpdateCartItemSchema } from '@marketbd/shared';
import { createZodDto } from 'nestjs-zod';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, ResponseMessage } from '../../common/decorators.js';
import { CartService } from './cart.service.js';

class AddToCartDto extends createZodDto(AddToCartSchema) {}
class UpdateCartItemDto extends createZodDto(UpdateCartItemSchema) {}
class MergeCartDto extends createZodDto(MergeCartSchema) {}
class SelectAllCartDto extends createZodDto(SelectAllCartSchema) {}

@ApiTags('cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  view(@CurrentUser() user: AuthUserContext) {
    return this.cart.view(user.id);
  }

  @Get('count')
  count(@CurrentUser() user: AuthUserContext) {
    return this.cart.count(user.id);
  }

  @Post('items')
  @ResponseMessage('Added to cart')
  add(@CurrentUser() user: AuthUserContext, @Body() dto: AddToCartDto) {
    return this.cart.add(user.id, dto);
  }

  @Patch('items/:id')
  update(@CurrentUser() user: AuthUserContext, @Param('id') id: string, @Body() dto: UpdateCartItemDto) {
    return this.cart.update(user.id, id, dto);
  }

  @Delete('items/:id')
  @ResponseMessage('Removed from cart')
  remove(@CurrentUser() user: AuthUserContext, @Param('id') id: string) {
    return this.cart.remove(user.id, id);
  }

  @Post('select-all')
  @HttpCode(200)
  selectAll(@CurrentUser() user: AuthUserContext, @Body() dto: SelectAllCartDto) {
    return this.cart.selectAll(user.id, dto.selected);
  }

  @Post('clear-unavailable')
  @HttpCode(200)
  clearUnavailable(@CurrentUser() user: AuthUserContext) {
    return this.cart.clearUnavailable(user.id);
  }

  @Post('merge')
  @HttpCode(200)
  merge(@CurrentUser() user: AuthUserContext, @Body() dto: MergeCartDto) {
    return this.cart.merge(user.id, dto);
  }
}
