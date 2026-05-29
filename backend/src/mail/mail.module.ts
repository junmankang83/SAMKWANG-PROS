import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [MailSmtpController, MailRuleController, MailMenuController],
  providers: [
    MailCryptoService,
    MailDeliveryService,
    MailSmtpService,
    MailRuleService,
    MailMenuService,
    MailSchedulerService,
  ],
  exports: [MailSmtpService, MailRuleService, MailMenuService],
})
export class MailModule {}
