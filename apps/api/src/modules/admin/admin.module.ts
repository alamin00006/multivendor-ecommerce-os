import { Module } from '@nestjs/common';
import { AdminController, StaffController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { StaffService } from './staff.service.js';

@Module({
  controllers: [AdminController, StaffController],
  providers: [AdminService, StaffService],
})
export class AdminModule {}
