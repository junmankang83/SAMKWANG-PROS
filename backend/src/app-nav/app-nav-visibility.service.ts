import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const NAV_DOMAIN_IDS = ['master-data', 'production', 'mold', 'mail'] as const;
export type NavDomainId = (typeof NAV_DOMAIN_IDS)[number];

const NAV_VISIBILITY_KEY = 'nav_domain_visibility';

function defaultDomains(): Record<NavDomainId, boolean> {
  return {
    'master-data': true,
    production: true,
    mold: true,
    mail: true,
  };
}

@Injectable()
export class AppNavVisibilityService {
  private readonly logger = new Logger(AppNavVisibilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<{ domains: Record<NavDomainId, boolean> }> {
    const defaults = defaultDomains();
    try {
      const row = await this.prisma.appConfigEntry.findUnique({
        where: { key: NAV_VISIBILITY_KEY },
      });
      const stored = row?.value as Record<string, unknown> | null;
      const domains = { ...defaults };
      if (stored && typeof stored === 'object') {
        for (const id of NAV_DOMAIN_IDS) {
          if (Object.prototype.hasOwnProperty.call(stored, id)) {
            domains[id] = Boolean(stored[id]);
          }
        }
      }
      return { domains };
    } catch (err: unknown) {
      this.logPrismaTableError('get', err);
      return { domains: defaults };
    }
  }

  /**
   * 상단 주메뉴(기준정보·부품관리·설비관리·메일발송관리) 표시 여부. 최소 1개는 표시되어야 합니다.
   */
  async set(patch: Record<string, unknown>): Promise<{ domains: Record<NavDomainId, boolean> }> {
    const current = await this.get();
    const next: Record<NavDomainId, boolean> = { ...current.domains };
    for (const id of NAV_DOMAIN_IDS) {
      if (Object.prototype.hasOwnProperty.call(patch, id)) {
        next[id] = Boolean(patch[id]);
      }
    }
    const visibleCount = NAV_DOMAIN_IDS.filter((id) => next[id]).length;
    if (visibleCount < 1) {
      throw new BadRequestException('최소 한 개의 상단 메뉴는 표시해야 합니다.');
    }
    try {
      await this.prisma.appConfigEntry.upsert({
        where: { key: NAV_VISIBILITY_KEY },
        create: { key: NAV_VISIBILITY_KEY, value: next as Prisma.InputJsonValue },
        update: { value: next as Prisma.InputJsonValue },
      });
    } catch (err: unknown) {
      this.logPrismaTableError('set', err);
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
        throw new ServiceUnavailableException(
          '메뉴 설정 테이블(AppConfigEntry)이 없습니다. 서버에서 `npx prisma db push` 또는 마이그레이션을 실행하세요.',
        );
      }
      throw new ServiceUnavailableException('메뉴 설정을 저장할 수 없습니다. DB 연결·권한을 확인하세요.');
    }
    return { domains: next };
  }

  private logPrismaTableError(op: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`nav-domains-visibility ${op} DB 경고(기본값 사용 또는 저장 실패): ${msg}`);
  }
}
