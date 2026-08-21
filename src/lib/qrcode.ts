import qrcode from "qrcode-generator";

function buildQr(text: string) {
  if (!text.trim()) throw new Error("Texto vacío");
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr;
}

export function createQrSvg(text: string): string {
  return buildQr(text).createSvgTag({ cellSize: 4, margin: 1, scalable: true });
}

export function createQrPngDataUrl(text: string, targetSize = 512): string {
  const qr = buildQr(text);
  const count = qr.getModuleCount();
  const scale = Math.max(2, Math.floor(targetSize / count));
  const dimension = count * scale;
  const canvas = document.createElement("canvas");
  canvas.width = dimension;
  canvas.height = dimension;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, dimension, dimension);
  ctx.fillStyle = "#0f172a";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(col * scale, row * scale, scale, scale);
      }
    }
  }
  return canvas.toDataURL("image/png");
}
