import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 로컬에서 기존 .next 가 root 소유일 때: NEXT_DIST_DIR=.next-build pnpm build
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../'),
  reactStrictMode: true,
  transpilePackages: ['@samkwang/shared', '@samkwang/ui-kit'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        source: '/login',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
  async rewrites() {
    const target = process.env.BACKEND_PROXY_TARGET ?? 'http://127.0.0.1:4000';
    return [{ source: '/api/:path*', destination: `${target.replace(/\/+$/, '')}/api/:path*` }];
  },
};

export default nextConfig;
