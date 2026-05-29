import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export type SendMailInput = {
  fromName: string;
  fromAddress: string;
  to: string[];
  subject: string;
  text: string;
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
    const res = await transport.sendMail({
      from,
      to: input.to.join(', '),
      subject: input.subject,
      text: input.text,
    });
    return { messageId: res.messageId };
  }

  logError(err: unknown, context: string): void {
    this.logger.warn(`${context}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
