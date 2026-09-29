// Renders an event as a clean square PNG (no watermark) for sharing.

import type { EventView } from './present';
import { colorOf, mix } from './present';
import { platform } from '../platform';

const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", sans-serif`;

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, weight = 800): number {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > 24);
  return size;
}

export async function renderShareImage(v: EventView, readoutIndex: number): Promise<Blob> {
  const W = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = W;
  const ctx = canvas.getContext('2d')!;
  const base = colorOf(v.ev.color, false);
  const g = ctx.createLinearGradient(0, 0, W, W);
  g.addColorStop(0, mix(base, '#ffffff', 0.92));
  g.addColorStop(1, mix(base, '#ffffff', 0.7));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);

  const ink = mix(base, '#000000', 0.55);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `160px ${FONT}`;
  ctx.fillText(v.ev.emoji || '📅', W / 2, 250);

  const shown = v.readouts[readoutIndex % v.readouts.length]?.shown ?? v.readouts[0].shown;
  ctx.fillStyle = ink;
  const size = fitText(ctx, shown.main, W - 140, 220);
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillText(shown.main, W / 2, 530);

  ctx.fillStyle = mix(base, '#000000', 0.35);
  const tsize = fitText(ctx, v.ev.title, W - 160, 64, 700);
  ctx.font = `700 ${tsize}px ${FONT}`;
  ctx.fillText(v.ev.private ? '' : v.ev.title, W / 2, 720);

  ctx.font = `500 40px ${FONT}`;
  ctx.globalAlpha = 0.8;
  ctx.fillText(shown.sub, W / 2, 800);
  ctx.fillText(v.dateLine, W / 2, 870);
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

export async function shareEvent(v: EventView, readoutIndex: number) {
  const blob = await renderShareImage(v, readoutIndex);
  const shown = v.readouts[readoutIndex % v.readouts.length]?.shown ?? v.readouts[0].shown;
  const safe = (v.ev.title || 'eehl').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'eehl';
  await platform.shareImage(blob, `${safe}.png`, `${v.ev.emoji} ${v.ev.title} · ${shown.main}`);
}
