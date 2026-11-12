import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

function read(path) {
  return readFileSync(resolve(process.cwd(), path));
}

function pngDimensions(file) {
  const png = read(file);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), colorType: png[25] };
}

describe('PWA install icons — iOS and other platforms', () => {
  it('declares a real Apple touch icon and web manifest in the HTML head', () => {
    const html = read('index.html').toString('utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(doc.querySelector('html').getAttribute('lang')).toBe('pt-BR');
    expect(doc.head.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe('/apple-touch-icon.png');
    expect(doc.head.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('sizes')).toBe('180x180');
    expect(doc.head.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest.webmanifest');
    expect(doc.head.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')).toBe('CoBalance');
    expect(doc.head.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBeTruthy();
  });

  it('serves an opaque, correctly sized iOS icon from public/', () => {
    expect(pngDimensions('public/apple-touch-icon.png')).toEqual({
      width: 180, height: 180, colorType: 2,
    });
  });

  it('declares valid standalone install icons', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest').toString('utf8'));
    expect(manifest.name).toBe('CoBalance');
    expect(manifest.short_name).toBe('CoBalance');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ src: '/pwa-512.png', sizes: '512x512', type: 'image/png' }),
    ]));
    expect(pngDimensions('public/pwa-192.png')).toEqual({ width: 192, height: 192, colorType: 2 });
    expect(pngDimensions('public/pwa-512.png')).toEqual({ width: 512, height: 512, colorType: 2 });
  });
});
