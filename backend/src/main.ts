import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';

function targetListenPort(publicBase: string): number | null {
  try {
    const u = new URL(publicBase);
    if (u.port) return Number(u.port);
    return u.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
}

function handlePublicRoot(req: Request, res: Response): void {
  const raw =
    process.env.PUBLIC_APP_BASE?.trim() ||
    process.env.FRONTEND_PUBLIC_URL?.trim();
  const publicBase = raw?.replace(/\/+$/, '') ?? '';
  const listenPort = req.socket.localPort ?? 0;

  if (publicBase) {
    const targetPort = targetListenPort(`${publicBase}/`);
    if (targetPort != null && targetPort !== listenPort) {
      res.redirect(302, `${publicBase}/`);
      return;
    }
  }

  res
    .status(200)
    .type('text/html; charset=utf-8')
    .send(`<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"/><title>SAMKWANG-PROS API</title></head>
<body style="font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;line-height:1.5">
<h1>백엔드(API)에 연결되었습니다</h1>
<p>프론트(Next.js) 화면은 <strong>웹 게이트웨이</strong>(Docker: <code>APP_WEB_PORT</code>, 기본 3000)로 접속하세요.</p>
<ul>
<li>API 상태: <a href="/api/health"><code>/api/health</code></a></li>
<li>백엔드만 호스트에 띄운 경우: 보통 <code>4000</code> 포트입니다. <code>3000</code>에 API가 떠 있으면 게이트웨이와 포트가 겹칩니다. 기존 프로세스를 중지한 뒤 <code>docker compose up -d</code> 하세요.</li>
<li><code>.env</code>의 <code>PUBLIC_APP_BASE</code>에 프론트 URL을 넣으면, 백엔드 <code>/</code>에서 포트가 다를 때 자동 이동합니다.</li>
</ul>
</body></html>`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 4000);
  const httpServer = app.getHttpAdapter().getInstance();
  httpServer.get('/', handlePublicRoot);

  await app.listen(port, '0.0.0.0');

  Logger.log(`SAMKWANG-PROS backend listening on http://0.0.0.0:${port}/api`, 'Bootstrap');
}

bootstrap().catch((err) => {
  Logger.error(`Failed to bootstrap: ${err}`, 'Bootstrap');
  process.exit(1);
});
