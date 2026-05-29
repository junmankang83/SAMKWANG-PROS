import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailCryptoService } from './mail-crypto.service';
import { MailDeliveryService } from './mail-delivery.service';
import type { UpsertMailSmtpDto } from './dto/mail-smtp.dto';

const DEFAULT_ID = 'default';

@Injectable()
export class MailSmtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: MailCryptoService,
    private readonly delivery: MailDeliveryService,
  ) {}

  async getSettings() {
    const row =
      (await this.prisma.mailSmtpSettings.findUnique({ where: { id: DEFAULT_ID } })) ??
      (await this.prisma.mailSmtpSettings.create({
        data: { id: DEFAULT_ID },
      }));
    return {
      id: row.id,
      host: row.host,
      port: row.port,
      secure: row.secure,
      user: row.user,
      fromName: row.fromName,
      fromAddress: row.fromAddress,
      hasPassword: Boolean(row.passwordCipher?.trim()),
      updatedAt: row.updatedAt,
    };
  }

  async upsertSettings(dto: UpsertMailSmtpDto) {
    const existing = await this.prisma.mailSmtpSettings.findUnique({ where: { id: DEFAULT_ID } });
    let passwordCipher = existing?.passwordCipher ?? '';
    if (dto.password != null && dto.password.trim().length > 0) {
      passwordCipher = this.crypto.encrypt(dto.password.trim());
    }
    await this.prisma.mailSmtpSettings.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        host: dto.host.trim(),
        port: dto.port,
        secure: dto.secure,
        user: dto.user.trim(),
        passwordCipher,
        fromName: dto.fromName.trim(),
        fromAddress: dto.fromAddress.trim(),
      },
      update: {
        host: dto.host.trim(),
        port: dto.port,
        secure: dto.secure,
        user: dto.user.trim(),
        passwordCipher,
        fromName: dto.fromName.trim(),
        fromAddress: dto.fromAddress.trim(),
      },
    });
    return this.getSettings();
  }

  /** SMTP 전송에 필요한 평문 비밀번호까지 포함 (메모리 내에서만 사용) */
  async resolveSmtpSecrets(): Promise<{
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromAddress: string;
  } | null> {
    const row = await this.prisma.mailSmtpSettings.findUnique({ where: { id: DEFAULT_ID } });
    if (!row) {
      return null;
    }
    const host = row.host.trim();
    const fromAddress = row.fromAddress.trim();
    if (!host || !fromAddress) {
      return null;
    }
    let password = '';
    if (row.passwordCipher.trim()) {
      try {
        password = this.crypto.decrypt(row.passwordCipher.trim());
      } catch {
        return null;
      }
    }
    return {
      host,
      port: row.port,
      secure: row.secure,
      user: row.user.trim(),
      password,
      fromName: row.fromName.trim(),
      fromAddress,
    };
  }

  async sendTest(to: string): Promise<{ messageId?: string }> {
    const cfg = await this.resolveSmtpSecrets();
    if (!cfg) {
      throw new BadRequestException('SMTP 설정(호스트·발신 주소·비밀번호)을 먼저 저장해 주세요.');
    }
    try {
      return await this.delivery.send({
        fromName: cfg.fromName || 'SAMKWANG-PROS',
        fromAddress: cfg.fromAddress,
        to: [to],
        subject: '[SAMKWANG-PROS] SMTP 테스트',
        text: `이 메일은 SAMKWANG-PROS SMTP 연결 테스트입니다.\n발송 시각(서버): ${new Date().toISOString()}\n`,
        smtp: {
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          user: cfg.user,
          password: cfg.password,
        },
      });
    } catch (e) {
      this.delivery.logError(e, 'sendTest');
      throw new BadRequestException(e instanceof Error ? e.message : '메일 발송에 실패했습니다.');
    }
  }
}
