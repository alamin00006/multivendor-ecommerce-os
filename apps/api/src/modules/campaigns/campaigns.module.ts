import { Module } from '@nestjs/common';
import { AdminCampaignsController, CampaignsController } from './campaigns.controller.js';
import { CampaignsService } from './campaigns.service.js';

@Module({
  controllers: [CampaignsController, AdminCampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
