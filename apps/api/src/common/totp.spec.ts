import { base32Decode, base32Encode, totpCode, verifyTotp } from './totp';

describe('TOTP', () => {
  // RFC 6238 test vector (SHA-1, secret "12345678901234567890")
  const secret = base32Encode(Buffer.from('12345678901234567890'));

  it('round-trips base32', () => {
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
  });

  it('matches RFC 6238 vectors', () => {
    expect(totpCode(secret, 59_000)).toBe('287082');
    expect(totpCode(secret, 1_111_111_109_000)).toBe('081804');
  });

  it('accepts one step of clock drift only', () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false);
  });
});
