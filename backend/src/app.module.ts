import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SessionAuthGuard } from './auth/session-auth.guard';
import { MasterDataModule } from './master-data/master-data.module';
import { SparePartsModule } from './spare-parts/spare-parts.module';
import { ErpModule } from './external/erp/erp.module';
import { MoldModule } from './mold/mold.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../.env'],
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    ErpModule,
    MasterDataModule,
    SparePartsModule,
    MoldModule,
    MailModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: SessionAuthGuard }],
})
export class AppModule {}
