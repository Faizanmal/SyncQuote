import { createHmac, randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20) {
  const buffer = randomBytes(bytes);
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let secret = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret;
}

function decodeBase32(secret: string) {
  const cleaned = secret.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const char of cleaned) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, token: string, window = 1) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset++) {
    if (hotp(secret, counter + offset) === token) {
      return true;
    }
  }
  return false;
}

export function otpauthUrl(email: string, secret: string) {
  return `otpauth://totp/SyncQuote:${encodeURIComponent(email)}?secret=${secret}&issuer=SyncQuote`;
}
