const FONT_URL = "/fonts/SairaCondensed-SemiBold.ttf";
let fontDataUrl: Promise<string> | null = null;

function loadFontDataUrl(): Promise<string> {
  fontDataUrl ??= fetch(FONT_URL)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
    );
  return fontDataUrl;
}

/** Serializes the SVG with the font embedded, so it renders identically anywhere. */
export async function buildSvgString(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("style");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const font = await loadFontDataUrl();
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `@font-face{font-family:ProfileFont;src:url(${font}) format("truetype");}`;
  clone.insertBefore(style, clone.firstChild);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadSvg(svg: SVGSVGElement, filename: string) {
  const str = await buildSvgString(svg);
  triggerDownload(new Blob([str], { type: "image/svg+xml" }), filename);
}

export async function downloadPng(svg: SVGSVGElement, filename: string, scale = 3) {
  const str = await buildSvgString(svg);
  const width = svg.viewBox.baseVal.width;
  const height = svg.viewBox.baseVal.height;
  const url = URL.createObjectURL(new Blob([str], { type: "image/svg+xml" }));

  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not render the SVG to an image."));
      img.src = url;
    });
    // Let the embedded font settle before rasterizing.
    await img.decode().catch(() => undefined);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed."))), "image/png"),
    );
    triggerDownload(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}
