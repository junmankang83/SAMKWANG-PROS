import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Attachment } from 'nodemailer/lib/mailer';

/** HTML `<img src="cid:…">` 와 nodemailer 첨부 `cid` 값 일치 */
export const SAMKWANG_MAIL_LOGO_CID = 'samkwang-mail-logo@samkwang.pros';

export function resolveSamkwangMailLogoAttachment(): Attachment | null {
  const logoPath = join(__dirname, 'assets', 'samkwang-mail-logo.png');
  if (!existsSync(logoPath)) {
    return null;
  }
  return {
    filename: 'samkwang-mail-logo.png',
    path: logoPath,
    cid: SAMKWANG_MAIL_LOGO_CID,
  };
}

/**
 * EIS 브랜딩(이미지 3 참고) — 이메일 클라이언트 호환용 테이블 마크업.
 * PNG가 없을 때도 동일한 정보가 전달되도록 텍스트·색으로 구성합니다.
 */
export function buildEisMailBrandingHtml(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-left:auto;border-collapse:collapse">
<tr>
<td style="vertical-align:middle;padding-right:10px;font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:700;color:#1e40af;line-height:1">EIS</td>
<td style="vertical-align:middle;text-align:left;font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;font-size:11px;line-height:1.45;color:#111">
<div style="color:#111;margin:0">Integration for Global Samkwang</div>
<div style="color:#991b1b;font-weight:700;margin:3px 0 0 0">Executive Information System</div>
<div style="color:#111;margin:3px 0 0 0">경영정보시스템</div>
</td>
</tr>
</table>`;
}

/** Asia/Seoul 기준 `2026년 6월 4일` 형식 */
export function formatSeoulInquiryDateLong(sendAt: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(sendAt);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parseInt(parts.find((p) => p.type === 'month')?.value ?? '1', 10);
  const d = parseInt(parts.find((p) => p.type === 'day')?.value ?? '1', 10);
  return `${y}년 ${m}월 ${d}일`;
}

/**
 * 이미지 1 레이아웃: 좌 SAMKWANG 로고, 가운데 밑줄 제목, 우 EIS 블록 + 조회일 한 줄.
 * `titleHtml`·`inquiryDateHtml` 은 이미 이스케이프된 조각이어야 합니다.
 */
export function buildMailBodyTitleBannerHtml(args: {
  titleHtml: string;
  inquiryDateHtml: string;
  hasLogo: boolean;
}): string {
  const logoCid = SAMKWANG_MAIL_LOGO_CID;
  const leftCell = args.hasLogo
    ? `<img src="cid:${logoCid}" width="150" alt="SAMKWANG" style="display:block;max-width:170px;height:auto;border:0" />`
    : `<span style="font-family:Malgun Gothic,sans-serif;font-weight:700;font-size:15px;color:#1e3a8a;letter-spacing:0.02em">SAMKWANG</span>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 12px 0">
<tr>
<td style="width:26%;vertical-align:middle;text-align:left;padding:6px 10px 6px 0">${leftCell}</td>
<td style="width:48%;vertical-align:middle;text-align:center;padding:6px 6px">
<div style="display:inline-block;border-bottom:3px solid #000;padding:0 12px 8px 12px">
<span style="font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;font-size:20px;font-weight:700;color:#000">${args.titleHtml}</span>
</div>
</td>
<td style="width:26%;vertical-align:middle;text-align:right;padding:6px 0 6px 6px">${buildEisMailBrandingHtml()}</td>
</tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:-4px 0 14px 0;font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;font-size:12px;color:#000">
<tr>
<td style="text-align:left;padding:2px 0">조회일 : ${args.inquiryDateHtml}</td>
<td style="text-align:right;padding:2px 0">&nbsp;</td>
</tr>
</table>`;
}
