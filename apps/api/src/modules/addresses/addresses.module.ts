import { Module } from '@nestjs/common';
import { AddressesController, GeoController } from './addresses.controller.js';
import { AddressesService } from './addresses.service.js';

@Module({
  controllers: [GeoController, AddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
