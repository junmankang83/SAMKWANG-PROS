import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailCryptoService } from './mail-crypto.service';
import { MailDeliveryService } from './mail-delivery.service';
import type { CreateMailSmtpProfileDto, UpdateMailSmtpProfileDto } from './dto/mail-smtp.dto';

function toPublicProfile(row: {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  fromAddress: string;
  sortOrder: number;
  passwordCipher: string;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    secure: row.secure,
    user: row.user,
    fromName: row.fromName,
    fromAddress: row.fromAddress,
    sortOrder: row.sortOrder,
    hasPassword: Boolean(row.passwordCipher?.trim()),
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class MailSmtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: MailCryptoService,
    private readonly delivery: MailDeliveryService,
  ) {}

  async list() {
    const rows = await this.prisma.mailSmtpProfile.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toPublicProfile);
  }

  async get(id: string) {
    const row = await this.prisma.mailSmtpProfile.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('SMTP 프로필을 찾을 수 없습니다.');
    }
    return toPublicProfile(row);
  }

  async create(dto: CreateMailSmtpProfileDto) {
    let passwordCipher = '';
    if (dto.password != null && dto.password.trim().length > 0) {
      passwordCipher = this.crypto.encrypt(dto.password.trim());
    }
    const row = await this.prisma.mailSmtpProfile.create({
      data: {
        name: dto.name.trim(),
        host: dto.host.trim(),
        port: dto.port,
        secure: dto.secure,
        user: dto.user.trim(),
        passwordCipher,
        fromName: dto.fromName.trim(),
        fromAddress: dto.fromAddress.trim(),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return toPublicProfile(row);
  }

  async update(id: string, dto: UpdateMailSmtpProfileDto) {
    const existing = await this.prisma.mailSmtpProfile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('SMTP 프로필을 찾을 수 없습니다.');
    }
    let passwordCipher: string | undefined;
    if (dto.password != null && dto.password.trim().length > 0) {
      passwordCipher = this.crypto.encrypt(dto.password.trim());
    }
    const row = await this.prisma.mailSmtpProfile.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        host: dto.host?.trim(),
        port: dto.port,
        secure: dto.secure,
        user: dto.user?.trim(),
        ...(passwordCipher !== undefined ? { passwordCipher } : {}),
        fromName: dto.fromName?.trim(),
        fromAddress: dto.fromAddress?.trim(),
        sortOrder: dto.sortOrder,
      },
    });
    return toPublicProfile(row);
  }

  async remove(id: string) {
    const n = await this.prisma.mailSmtpProfile.count();
    if (n <= 1) {
      throw new BadRequestException('마지막 SMTP 프로필은 삭제할 수 없습니다.');
    }
    const used = await this.prisma.mailSendRule.count({ where: { mailSmtpProfileId: id } });
    if (used > 0) {
      throw new BadRequestException(`이 프로필을 사용 중인 발송 규칙이 ${used}건 있습니다. 규칙에서 다른 프로필을 선택한 뒤 삭제하세요.`);
    }
    await this.prisma.mailSmtpProfile.delete({ where: { id } });
  }

  /**
   * profileId 가 있으면 해당 프로필, 없으면 sortOrder·이름 순 첫 프로필.
   * SMTP 전송에 필요한 평문 비밀번호까지 포함 (메모리 내에서만 사용).
   */
  async resolveSmtpSecrets(profileId?: string | null): Promise<{
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromAddress: string;
  } | null> {
    const row = profileId
      ? await this.prisma.mailSmtpProfile.findUnique({ where: { id: profileId } })
      : await this.prisma.mailSmtpProfile.findFirst({
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
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

  async sendTest(profileId: string, toAddresses: string[]): Promise<{ messageId?: string }> {
    const to = [...new Set(toAddresses.map((e) => e.trim()).filter(Boolean))];
    if (to.length === 0) {
      throw new BadRequestException('수신 이메일을 하나 이상 입력하세요.');
    }
    const cfg = await this.resolveSmtpSecrets(profileId);
    if (!cfg) {
      throw new BadRequestException('SMTP 프로필(호스트·발신 주소·비밀번호)을 확인해 주세요.');
    }
    try {
      return await this.delivery.send({
        fromName: cfg.fromName || 'SAMKWANG-PROS',
        fromAddress: cfg.fromAddress,
        to,
        subject: '[SAMKWANG-PROS] SMTP 테스트',
        text: `이 메일은 SAMKWANG-PROS SMTP 연결 테스트입니다.\n프로필 ID: ${profileId}\n수신: ${to.join(', ')}\n발송 시각(서버): ${new Date().toISOString()}\n`,
        mailHtmlBannerTitle: 'SAMKWANG-PROS SMTP 연결 테스트',
        mailHtmlBannerSendAt: new Date(),
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
