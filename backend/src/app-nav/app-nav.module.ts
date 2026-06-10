import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppNavVisibilityController } from './app-nav-visibility.controller';
import { AppNavVisibilityService } from './app-nav-visibility.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppNavVisibilityController],
  providers: [AppNavVisibilityService],
  exports: [AppNavVisibilityService],
})
export class AppNavModule {}
