import { Module } from '@nestjs/common';
import { UserFeaturesController } from './user-features.controller';
import { UserFeaturesService } from './user-features.service';

@Module({
  controllers: [UserFeaturesController],
  providers: [UserFeaturesService],
  exports: [UserFeaturesService],
})
export class UserFeaturesModule {}
