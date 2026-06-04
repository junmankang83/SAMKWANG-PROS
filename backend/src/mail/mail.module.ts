import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ErpModule } from '../external/erp/erp.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailCryptoService } from './mail-crypto.service';
import { MailDeliveryService } from './mail-delivery.service';
import { MailSmtpService } from './mail-smtp.service';
import { MailSmtpController } from './mail-smtp.controller';
import { MailRuleService } from './mail-rule.service';
import { MailRuleController } from './mail-rule.controller';
import { MailMenuService } from './mail-menu.service';
import { MailMenuController } from './mail-menu.controller';
import { MailSchedulerService } from './mail-scheduler.service';
import { MailSendLogsService } from './mail-send-logs.service';
import { MailSendLogsController } from './mail-send-logs.controller';
import { MailOpenService } from './mail-open.service';
import { MailOpenController } from './mail-open.controller';
import { MailMenuReportService } from './mail-menu-report.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), ErpModule],
  controllers: [
    MailSmtpController,
    MailRuleController,
    MailMenuController,
    MailSendLogsController,
    MailOpenController,
  ],
  providers: [
    MailCryptoService,
    MailDeliveryService,
    MailSmtpService,
    MailRuleService,
    MailMenuService,
    MailSchedulerService,
    MailSendLogsService,
    MailOpenService,
    MailMenuReportService,
  ],
  exports: [MailSmtpService, MailRuleService, MailMenuService],
})
export class MailModule {}
