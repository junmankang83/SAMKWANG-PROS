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
import { AppNavModule } from './app-nav/app-nav.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // 기본(true)이면 { ...파일, ...process.env }로 합쳐져 OS·쉘의 ERP_*가 .env보다 우선합니다.
      // 검증 스크립트는 파일만 읽어 통과하는데 Nest만 다른 비밀번호로 접속하는 불일치를 막습니다.
      validatePredefined: false,
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
    AppNavModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: SessionAuthGuard }],
})
export class AppModule {}
