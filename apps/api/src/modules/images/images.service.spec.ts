import { GatewayTimeoutException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImagesService } from './images.service.js';

const timeoutError = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

describe('ImagesService source failures', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails fast for every URL of a host that just timed out', async () => {
    const fetchMock = vi.fn().mockRejectedValue(timeoutError());
    vi.stubGlobal('fetch', fetchMock);
    const service = new ImagesService();

    await expect(service.resize('https://picsum.photos/seed/a/800/800', 256, 75, 'webp')).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
    // A different image on the same host must not hit the network again.
    await expect(service.resize('https://picsum.photos/seed/b/800/800', 256, 75, 'webp')).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not block other hosts', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(timeoutError()).mockRejectedValueOnce(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new ImagesService();

    await expect(service.resize('https://picsum.photos/seed/a/800/800', 256, 75, 'webp')).rejects.toThrow();
    await expect(service.resize('http://localhost:9000/marketbd/x.webp', 256, 75, 'webp')).rejects.toThrow(
      'Could not reach the source image host',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
