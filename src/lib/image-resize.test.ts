// @vitest-environment jsdom
//
// jsdom has no real Canvas/ImageBitmap backend, so createImageBitmap and
// canvas.getContext('2d') both fail here — every call in this test
// environment exercises resizeToWebp's fallback branch (return the original
// file untouched), not the actual resize/encode path. That's still real
// coverage of the function's control flow (decode failure -> catch ->
// extension parsing), just not the pixel-manipulation happy path, which
// needs a real browser and isn't unit-testable in jsdom.
import { describe, expect, it } from 'vitest';

import { resizeToWebp } from './image-resize';

describe('resizeToWebp', () => {
  it('falls back to the original file when the browser cannot decode/encode it', async () => {
    const file = new File(['fake-image-bytes'], 'photo.PNG', { type: 'image/png' });
    const result = await resizeToWebp(file, 1000);
    expect(result.blob).toBe(file);
    expect(result.ext).toBe('png');
    expect(result.type).toBe('image/png');
  });

  it('defaults to a jpg extension when the filename has none', async () => {
    const file = new File(['x'], 'photo', { type: '' });
    const result = await resizeToWebp(file, 1000);
    expect(result.ext).toBe('jpg');
    expect(result.type).toBe('application/octet-stream');
  });
});
