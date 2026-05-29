import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

@Injectable()
export class MailCryptoService {
  private key(): Buffer {
    const raw = process.env.MAIL_ENCRYPTION_KEY?.trim() ?? '';
    return createHash('sha256')
      .update(raw.length > 0 ? raw : 'samkwang-pros-mail-key-change-in-production')
      .digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALG, this.key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64url');
  }

  decrypt(b64url: string): string {
    const buf = Buffer.from(b64url, 'base64url');
    if (buf.length < IV_LEN + TAG_LEN) {
      throw new Error('Invalid cipher payload');
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALG, this.key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }
}
