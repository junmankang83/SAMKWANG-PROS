import type { Attachment } from 'nodemailer/lib/mailer';
import {
  buildMailBodyTitleBannerHtml,
  formatSeoulInquiryDateLong,
  resolveSamkwangMailLogoAttachment,
} from './mail-html-body-banner';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type MailHtmlStructuredTable = {
  /** 표 앞 본문(순수 텍스트, HTML에서 이스케이프·줄바꿈 처리) */
  intro: string;
  /** 서버에서만 생성한 안전한 HTML 조각(주로 `<table>…`) */
  tableHtml: string;
};

export type MailHtmlBuildResult = {
  html: string;
  attachments: Attachment[];
};

/**
 * multipart/alternative HTML 본문.
 * - `structured`가 있으면: intro를 `<br/>`로 감싼 뒤 표 HTML을 붙임(표는 이미 안전해야 함).
 * - 없으면: `plainFallback` 전체를 이스케이프 후 줄바꿈만 `<br/>`.
 * - `mailHtmlBannerTitle` 이 있으면 상단에 SAMKWANG·EIS 형식 타이틀 배너(로고 CID 첨부).
 */
export function buildMailHtmlBody(args: {
  plainFallback: string;
  openPixelUrl?: string;
  structured?: MailHtmlStructuredTable | null;
  /** HTML 본문 상단 배너에 쓸 제목(메뉴명 등, 순수 텍스트 — 내부에서 이스케이프) */
  mailHtmlBannerTitle?: string | null;
  /** 배너 `조회일`(서울). 없으면 `new Date()` */
  mailHtmlBannerSendAt?: Date | null;
}): MailHtmlBuildResult {
  const attachments: Attachment[] = [];
  let bannerHtml = '';
  const rawBannerTitle = args.mailHtmlBannerTitle?.trim();
  if (rawBannerTitle) {
    const att = resolveSamkwangMailLogoAttachment();
    if (att) {
      attachments.push(att);
    }
    const sendAt = args.mailHtmlBannerSendAt ?? new Date();
    const inquiryLabel = formatSeoulInquiryDateLong(sendAt);
    bannerHtml = buildMailBodyTitleBannerHtml({
      titleHtml: escapeHtml(rawBannerTitle),
      inquiryDateHtml: escapeHtml(inquiryLabel),
      hasLogo: Boolean(att),
    });
  }

  let inner: string;
  if (args.structured) {
    const introHtml = escapeHtml(args.structured.intro).replace(/\r\n|\r|\n/g, '<br/>\n');
    inner = `${introHtml}<div style="overflow-x:auto;margin-top:12px">${args.structured.tableHtml}</div>`;
  } else {
    inner = escapeHtml(args.plainFallback).replace(/\r\n|\r|\n/g, '<br/>\n');
  }
  inner = `${bannerHtml}${inner}`;

  const pixel = args.openPixelUrl?.trim();
  /** 일부 클라이언트는 1×1 숨김 div를 건너뛰므로, 본문 끝에 일반 블록으로 두고 스타일만 최소화 */
  const pixelBlock = pixel
    ? `<p style="margin:0;padding:0;line-height:0;font-size:0;max-height:1px;overflow:hidden;color:transparent" aria-hidden="true">` +
      `<img src="${escapeHtml(pixel)}" width="1" height="1" alt="" ` +
      `style="display:block;width:1px;height:1px;border:0;margin:0;padding:0;opacity:0.01" ` +
      `loading="eager" decoding="async" referrerpolicy="no-referrer" /></p>`
    : '';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Malgun Gothic,Apple SD Gothic Neo,system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#111">${inner}${pixelBlock}</body></html>`;
  return { html, attachments };
}

/** @deprecated 내부에서 `buildMailHtmlBody` 사용 권장 */
export function buildMailHtmlWithOpenPixel(plainText: string, pixelUrl: string): string {
  return buildMailHtmlBody({ plainFallback: plainText, openPixelUrl: pixelUrl }).html;
}
