import type { Config } from 'tailwindcss';
import samkwangPreset from '@samkwang/ui-kit/tailwind-preset';

const config: Config = {
  presets: [samkwangPreset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './node_modules/@samkwang/ui-kit/dist/**/*.{js,cjs,mjs}',
  ],
  // ui-kit CSS에 base/리셋이 포함됨 — 앱 preflight가 button 배경을 덮어쓰지 않도록 비활성화
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
