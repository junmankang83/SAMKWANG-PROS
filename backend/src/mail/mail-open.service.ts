import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OPEN_TRACKING_TOKEN_REGEX } from './mail-send-token';

@Injectable()
export class MailOpenService {
  constructor(private readonly prisma: PrismaService) {}

  /** 픽셀 요청 시 호출. 토큰이 유효하면 열람 시각·횟수를 갱신합니다. */
  async recordOpenIfValid(token: string | undefined): Promise<void> {
    if (!token || !OPEN_TRACKING_TOKEN_REGEX.test(token)) {
      return;
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const menu = await tx.mailMenuSendLog.findFirst({
        where: { openTrackingToken: token },
        select: { id: true, firstOpenedAt: true },
      });
      if (menu) {
        await tx.mailMenuSendLog.update({
          where: { id: menu.id },
          data: {
            openCount: { increment: 1 },
            ...(menu.firstOpenedAt == null ? { firstOpenedAt: now } : {}),
          },
        });
        return;
      }
      const ruleLog = await tx.mailSendLog.findFirst({
        where: { openTrackingToken: token },
        select: { id: true, firstOpenedAt: true },
      });
      if (ruleLog) {
        await tx.mailSendLog.update({
          where: { id: ruleLog.id },
          data: {
            openCount: { increment: 1 },
            ...(ruleLog.firstOpenedAt == null ? { firstOpenedAt: now } : {}),
          },
        });
      }
    });
  }
}
