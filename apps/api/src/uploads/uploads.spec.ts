import { detectImageType } from './uploads.controller';

describe('image upload validation', () => {
  it('detects images by magic bytes', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('jpg');
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe('png');
    expect(detectImageType(Buffer.from('RIFF0000WEBPVP8 '))).toBe('webp');
  });

  it('rejects other files even with an image extension', () => {
    expect(detectImageType(Buffer.from('<svg onload="alert(1)"></svg>'))).toBeUndefined();
    expect(detectImageType(Buffer.from('MZ executable data'))).toBeUndefined();
  });
});
