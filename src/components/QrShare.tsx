import { useMemo, useState } from "react";
import { Copy, Download, QrCode, Share2 } from "lucide-react";
import { Button, TextInput } from "./ui";
import { createQrPngDataUrl, createQrSvg } from "../lib/qrcode";

interface QrShareProps {
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}

export function QrShare({ onToast }: QrShareProps) {
  const [url, setUrl] = useState<string>(() => window.location.origin);

  const svg = useMemo(() => {
    try {
      return createQrSvg(url);
    } catch {
      return "";
    }
  }, [url]);

  const onCopy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => onToast("Enlace copiado", "success"))
      .catch(() => onToast("No se pudo copiar el enlace", "error"));
  };

  const onShare = () => {
    if (typeof navigator.share === "function") {
      navigator.share({ title: "GamalierSolar", url }).catch(() => undefined);
    } else {
      onToast("Este navegador no soporta compartir; usa Copiar o el QR", "info");
    }
  };

  const onDownload = () => {
    try {
      const dataUrl = createQrPngDataUrl(url, 640);
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = "gamaliersolar-qr.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      onToast("QR descargado", "success");
    } catch {
      onToast("No se pudo generar la imagen del QR", "error");
    }
  };

  return (
    <div>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="grid size-44 shrink-0 place-items-center rounded-xl bg-white p-3 ring-1 ring-slate-700">
          {svg ? (
            <div
              className="size-full [&_svg]:size-full"
              role="img"
              aria-label="Código QR de acceso a la aplicación"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <QrCode className="size-10 text-slate-400" aria-hidden />
          )}
        </div>

        <div className="w-full space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Enlace a compartir
            </span>
            <TextInput value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
          </label>
          <p className="text-xs text-slate-500">
            Si accedes por <code className="text-slate-400">localhost</code>, sustitúyelo por la IP
            de este PC en tu red (por ejemplo <code className="text-slate-400">http://192.168.1.50:5173</code>)
            para que el QR funcione en el móvil.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={onShare}>
              <Share2 className="size-4" aria-hidden /> Compartir
            </Button>
            <Button variant="ghost" onClick={onCopy}>
              <Copy className="size-4" aria-hidden /> Copiar
            </Button>
            <Button variant="ghost" onClick={onDownload}>
              <Download className="size-4" aria-hidden /> Descargar PNG
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
