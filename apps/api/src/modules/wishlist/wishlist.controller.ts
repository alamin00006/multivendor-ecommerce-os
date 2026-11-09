import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUserContext } from '../../common/auth-user.js';
import { CurrentUser, ResponseMessage } from '../../common/decorators.js';
import { WishlistService } from './wishlist.service.js';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthUserContext) {
    return this.wishlist.list(user.id);
  }

  @Get('ids')
  ids(@CurrentUser() user: AuthUserContext) {
    return this.wishlist.ids(user.id);
  }

  @Post(':productId')
  @ResponseMessage('Saved to wishlist')
  add(@CurrentUser() user: AuthUserContext, @Param('productId') productId: string) {
    return this.wishlist.add(user.id, productId);
  }

  @Delete(':productId')
  @ResponseMessage('Removed from wishlist')
  remove(@CurrentUser() user: AuthUserContext, @Param('productId') productId: string) {
    return this.wishlist.remove(user.id, productId);
  }
}
