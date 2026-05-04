import { describe, it, expect } from '@jest/globals';
import { isHeic } from './image-utils';

function ftypBuffer(brand: string): Buffer {
  const buf = Buffer.alloc(12);
  buf.write('xxxx', 0, 'ascii');
  buf.write('ftyp', 4, 'ascii');
  buf.write(brand.padEnd(4, ' ').slice(0, 4), 8, 'ascii');
  return buf;
}

describe('isHeic', () => {
  it('detects by mime type', () => {
    expect(isHeic('image/heic')).toBe(true);
    expect(isHeic('image/heif')).toBe(true);
    expect(isHeic('IMAGE/HEIC')).toBe(true);
    expect(isHeic('image/heic-sequence')).toBe(true);
  });

  it('rejects non-HEIC mimes', () => {
    expect(isHeic('image/jpeg')).toBe(false);
    expect(isHeic('image/png')).toBe(false);
    expect(isHeic('image/webp')).toBe(false);
  });

  it('detects by filename extension when mime is empty (iOS Safari case)', () => {
    expect(isHeic('', 'IMG_1234.HEIC')).toBe(true);
    expect(isHeic('', 'photo.heif')).toBe(true);
    expect(isHeic(undefined, 'photo.heic')).toBe(true);
    expect(isHeic(null, 'photo.heic')).toBe(true);
  });

  it('rejects non-HEIC extensions', () => {
    expect(isHeic('', 'photo.jpg')).toBe(false);
    expect(isHeic('', 'photo.png')).toBe(false);
    expect(isHeic('', 'photo.webp')).toBe(false);
  });

  it('detects by ISO BMFF brand magic bytes', () => {
    expect(isHeic('', '', ftypBuffer('heic'))).toBe(true);
    expect(isHeic('', '', ftypBuffer('heix'))).toBe(true);
    expect(isHeic('', '', ftypBuffer('mif1'))).toBe(true);
    expect(isHeic('', '', ftypBuffer('msf1'))).toBe(true);
  });

  it('rejects non-HEIC brands', () => {
    expect(isHeic('', '', ftypBuffer('mp42'))).toBe(false);
    expect(isHeic('', '', ftypBuffer('isom'))).toBe(false);
  });

  it('returns false when buffer too short for brand check', () => {
    expect(isHeic('', '', Buffer.alloc(4))).toBe(false);
  });

  it('returns false when nothing identifies HEIC', () => {
    expect(isHeic()).toBe(false);
    expect(isHeic('', '')).toBe(false);
    expect(isHeic('image/jpeg', 'photo.jpg')).toBe(false);
  });
});
