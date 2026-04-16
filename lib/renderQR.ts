import QRCode from "qrcode";

export type Style = "square" | "circles";

export interface RenderOptions {
  text: string;
  style: Style;
  fg: string;
  bg: string;
  logo?: HTMLImageElement | null;
  cellPx?: number;
  quiet?: number;
  dotRatio?: number;
}

type AnyCtx2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

interface Resolved {
  size: number;
  imgPx: number;
  data: Uint8Array;
  cellPx: number;
  quiet: number;
  dotRatio: number;
}

function resolve(opts: RenderOptions): Resolved {
  const cellPx = opts.cellPx ?? 20;
  const quiet = opts.quiet ?? 4;
  const dotRatio = opts.dotRatio ?? 0.85;
  const qr = QRCode.create(opts.text, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const data = qr.modules.data as unknown as Uint8Array;
  const imgPx = (size + 2 * quiet) * cellPx;
  return { size, imgPx, data, cellPx, quiet, dotRatio };
}

function draw(ctx: AnyCtx2D, opts: RenderOptions, r: Resolved): void {
  const { size, imgPx, data, cellPx, quiet, dotRatio } = r;
  const { style, fg, bg, logo } = opts;
  const isDark = (row: number, col: number) => data[row * size + col] === 1;

  ctx.clearRect(0, 0, imgPx, imgPx);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, imgPx, imgPx);

  if (style === "square") {
    ctx.fillStyle = fg;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (!isDark(row, col)) continue;
        ctx.fillRect(
          (quiet + col) * cellPx,
          (quiet + row) * cellPx,
          cellPx,
          cellPx,
        );
      }
    }
  } else {
    const finderOrigins: [number, number][] = [
      [quiet * cellPx, quiet * cellPx],
      [quiet * cellPx, (quiet + size - 7) * cellPx],
      [(quiet + size - 7) * cellPx, quiet * cellPx],
    ];
    for (const [ox, oy] of finderOrigins) {
      drawFinder(ctx, ox, oy, cellPx, fg, bg);
    }

    const dotMargin = (cellPx * (1 - dotRatio)) / 2;
    const dotSize = cellPx * dotRatio;
    ctx.fillStyle = fg;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (!isDark(row, col)) continue;
        if (isInFinder(row, col, size)) continue;
        const x = (quiet + col) * cellPx + dotMargin;
        const y = (quiet + row) * cellPx + dotMargin;
        ctx.beginPath();
        ctx.arc(x + dotSize / 2, y + dotSize / 2, dotSize / 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  if (logo) {
    const logoMax = imgPx * 0.25;
    const lw = logo.naturalWidth;
    const lh = logo.naturalHeight;
    const scale = logoMax / Math.max(lw, lh);
    const newLw = lw * scale;
    const newLh = lh * scale;
    const pad = Math.max(newLw, newLh) * 0.15;
    const bgDia = Math.max(newLw, newLh) + 2 * pad;

    const bx = (imgPx - bgDia) / 2;
    const by = (imgPx - bgDia) / 2;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx + bgDia / 2, by + bgDia / 2, bgDia / 2, 0, 2 * Math.PI);
    ctx.fill();

    ctx.drawImage(
      logo,
      bx + (bgDia - newLw) / 2,
      by + (bgDia - newLh) / 2,
      newLw,
      newLh,
    );
  }
}

/** Render to an on-screen canvas for preview. */
export function renderQR(
  opts: RenderOptions,
  target?: HTMLCanvasElement,
): HTMLCanvasElement {
  const r = resolve(opts);
  const canvas = target ?? document.createElement("canvas");
  canvas.width = r.imgPx;
  canvas.height = r.imgPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  draw(ctx, opts, r);
  return canvas;
}

/**
 * Render to a detached canvas and produce a PNG Blob.
 * Uses OffscreenCanvas.convertToBlob when available — it bypasses the
 * DOM/GPU compositor entirely, which is what HTMLCanvasElement.toBlob
 * sometimes gets wrong (producing corrupt PNGs despite correct display).
 */
export async function renderQRToBlob(opts: RenderOptions): Promise<Blob> {
  const r = resolve(opts);

  if (typeof OffscreenCanvas !== "undefined") {
    const off = new OffscreenCanvas(r.imgPx, r.imgPx);
    const ctx = off.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
    draw(ctx, opts, r);
    return off.convertToBlob({ type: "image/png" });
  }

  // Fallback for environments without OffscreenCanvas.
  const canvas = document.createElement("canvas");
  canvas.width = r.imgPx;
  canvas.height = r.imgPx;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  draw(ctx, opts, r);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG encode failed")),
      "image/png",
    );
  });
}

function isInFinder(r: number, c: number, size: number): boolean {
  return (
    (r < 7 && c < 7) ||
    (r < 7 && c >= size - 7) ||
    (r >= size - 7 && c < 7)
  );
}

function drawFinder(
  ctx: AnyCtx2D,
  ox: number,
  oy: number,
  cell: number,
  fg: string,
  bg: string,
) {
  const r = cell * 0.35;
  roundedRect(ctx, ox, oy, 7 * cell, 7 * cell, r, fg);
  roundedRect(ctx, ox + cell, oy + cell, 5 * cell, 5 * cell, r, bg);
  roundedRect(ctx, ox + 2 * cell, oy + 2 * cell, 3 * cell, 3 * cell, r, fg);
}

function roundedRect(
  ctx: AnyCtx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
  ctx.fill();
}
