import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { Attachment } from 'nodemailer/lib/mailer';
import { buildMailHtmlBody } from './mail-html-body';

export type SendMailInput = {
  fromName: string;
  fromAddress: string;
  to: string[];
  subject: string;
  text: string;
  /** 설정 시 multipart(alternative)로 HTML을 함께 보내고 본문 하단에 열람 추적 픽셀을 넣습니다. */
  openPixelUrl?: string;
  /** 거래명세 표 등: HTML 파트에만 넣을 안전한 `<table>…` 조각(`appendMenuDataReport`와 함께 사용) */
  mailHtmlTableFragment?: string;
  /** `mailHtmlTableFragment` 앞에 표시할 순수 텍스트(사용자 본문·표 제목 등) */
  mailHtmlStructuredIntro?: string;
  /** HTML 본문 상단 SAMKWANG·EIS 형식 타이틀 배너(메뉴명·제목 등) */
  mailHtmlBannerTitle?: string;
  /** 배너 `조회일`(서울 기준 표시). 없으면 발송 시각 */
  mailHtmlBannerSendAt?: Date;
  /** 조회 데이터 xlsx — 파일명은 보통 메일 제목과 동일(`subjectToXlsxFilename`) */
  excelAttachment?: { filename: string; content: Buffer };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
};

@Injectable()
export class MailDeliveryService {
  private readonly logger = new Logger(MailDeliveryService.name);

  async send(input: SendMailInput): Promise<{ messageId?: string }> {
    const { smtp } = input;
    const options: SMTPTransport.Options = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
    };
    const transport = nodemailer.createTransport(options);
    const from = `${input.fromName} <${input.fromAddress}>`.trim();
    const pixel = input.openPixelUrl?.trim();
    const structured =
      input.mailHtmlTableFragment != null && input.mailHtmlTableFragment.length > 0
        ? { intro: input.mailHtmlStructuredIntro ?? '', tableHtml: input.mailHtmlTableFragment }
        : null;
    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: input.to.join(', '),
      subject: input.subject,
      text: input.text,
    };
    const excelAtt = input.excelAttachment;
    const excelNodemailerAttachments: Attachment[] =
      excelAtt?.content && excelAtt.content.length > 0 && excelAtt.filename?.trim()
        ? [
            {
              filename: excelAtt.filename.trim(),
              content: excelAtt.content,
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ]
        : [];
    const wantsHtml =
      Boolean(pixel) ||
      Boolean(structured) ||
      Boolean(input.mailHtmlBannerTitle?.trim());
    if (wantsHtml) {
      const built = buildMailHtmlBody({
        plainFallback: input.text,
        openPixelUrl: pixel,
        structured,
        mailHtmlBannerTitle: input.mailHtmlBannerTitle,
        mailHtmlBannerSendAt: input.mailHtmlBannerSendAt ?? null,
      });
      mailOptions.html = built.html;
      const merged: Attachment[] = [...excelNodemailerAttachments, ...built.attachments];
      if (merged.length > 0) {
        mailOptions.attachments = merged;
      }
    } else if (excelNodemailerAttachments.length > 0) {
      mailOptions.attachments = excelNodemailerAttachments;
    }
    const res = await transport.sendMail(mailOptions);
    return { messageId: res.messageId };
  }

  logError(err: unknown, context: string): void {
    this.logger.warn(`${context}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
