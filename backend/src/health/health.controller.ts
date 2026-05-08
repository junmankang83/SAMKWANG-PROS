import { Controller, Get } from '@nestjs/common';
import type { HealthCheckResponse, HealthState } from '@samkwang/shared';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getHealth(): Promise<HealthCheckResponse> {
    const databaseStatus: HealthState = await this.checkDatabase();
    const overall: HealthState = databaseStatus === 'ok' ? 'ok' : 'degraded';

    return {
      status: overall,
      service: 'samkwang-backend',
      version: process.env.APP_VERSION ?? '0.1.0',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: databaseStatus,
      },
    };
  }

  private async checkDatabase(): Promise<HealthState> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
