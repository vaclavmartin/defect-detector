"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DetectedComponent = {
  id: number;
  pixelCount: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  sumX: number;
  sumY: number;
};

type DetectionResult = {
  width: number;
  height: number;
  components: Array<{
    id: number;
    pixelCount: number;
    centerX: number;
    centerY: number;
    radius: number;
  }>;
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function DefectDetector() {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [minSpotSizePx, setMinSpotSizePx] = useState<number>(40);
  const [minContrastPercent, setMinContrastPercent] = useState<number>(12);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const debouncedParams = useDebounced({ minSpotSizePx, minContrastPercent, imageUrl }, 150);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  // Removed sample loader per request

  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImageElement(img);
    img.onerror = () => setImageElement(null);
    img.src = imageUrl;
  }, [imageUrl]);

  const drawOverlays = useCallback((res: DetectionResult | null) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!res) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(220, 38, 38, 0.9)"; // red-600
    ctx.fillStyle = "rgba(220, 38, 38, 0.15)";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(220, 38, 38, 0.12)";

    for (const comp of res.components) {
      ctx.beginPath();
      ctx.arc(comp.centerX, comp.centerY, comp.radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.fillStyle = "rgba(220, 38, 38, 1)";
      ctx.fillText(`#${comp.id} (${comp.pixelCount})`, comp.centerX + comp.radius + 4, comp.centerY - 6);
      ctx.fillStyle = "rgba(220, 38, 38, 0.12)";
    }
  }, []);

  const analyze = useCallback(async () => {
    if (!imageElement) return;
    setIsProcessing(true);

    const w = imageElement.naturalWidth;
    const h = imageElement.naturalHeight;

    // Prepare canvases
    const hiddenCanvas = hiddenCanvasRef.current ?? document.createElement("canvas");
    hiddenCanvasRef.current = hiddenCanvas;
    hiddenCanvas.width = w;
    hiddenCanvas.height = h;
    const hiddenCtx = hiddenCanvas.getContext("2d", { willReadFrequently: true });
    if (!hiddenCtx) {
      setIsProcessing(false);
      return;
    }
    hiddenCtx.clearRect(0, 0, w, h);
    hiddenCtx.drawImage(imageElement, 0, 0, w, h);
    const { data } = hiddenCtx.getImageData(0, 0, w, h);

    // Convert to grayscale and compute mean
    const numPixels = w * h;
    const gray = new Float32Array(numPixels);
    let sum = 0;
    let idx = 0;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[idx++] = y;
      sum += y;
    }
    const mean = sum / numPixels;

    const thr = (minContrastPercent / 100) * 255;
    const mask = new Uint8Array(numPixels);
    for (let p = 0; p < numPixels; p++) {
      const y = gray[p];
      mask[p] = Math.abs(y - mean) >= thr ? 1 : 0;
    }

    // Connected Components Labeling (two-pass with union-find)
    const width = w;
    const height = h;
    const labels = new Int32Array(numPixels);
    let nextLabel = 1;
    const parent: number[] = [0];

    function find(a: number): number {
      while (parent[a] !== a) a = parent[a] = parent[parent[a]];
      return a;
    }
    function unite(a: number, b: number) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    }

    parent[0] = 0;

    // First pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (mask[i] === 0) continue;
        const left = x > 0 ? labels[i - 1] : 0;
        const up = y > 0 ? labels[i - width] : 0;
        if (left === 0 && up === 0) {
          labels[i] = nextLabel;
          parent[nextLabel] = nextLabel;
          nextLabel++;
        } else if (left !== 0 && up === 0) {
          labels[i] = left;
        } else if (left === 0 && up !== 0) {
          labels[i] = up;
        } else {
          labels[i] = Math.min(left, up);
          if (left !== up) unite(left, up);
        }
      }
    }

    // Flatten parent
    for (let l = 1; l < parent.length; l++) parent[l] = find(l);

    // Second pass: relabel and collect stats
    const mapOldToNew = new Map<number, number>();
    let newLabelCounter = 1;
    const components: Record<number, DetectedComponent> = {};

    for (let i = 0; i < numPixels; i++) {
      if (labels[i] === 0) continue;
      const root = parent[labels[i]];
      let newLabel = mapOldToNew.get(root);
      if (!newLabel) {
        newLabel = newLabelCounter++;
        mapOldToNew.set(root, newLabel);
      }
      labels[i] = newLabel;

      const x = i % width;
      const y = Math.floor(i / width);
      if (!components[newLabel]) {
        components[newLabel] = {
          id: newLabel,
          pixelCount: 0,
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          sumX: 0,
          sumY: 0,
        };
      }
      const c = components[newLabel];
      c.pixelCount++;
      if (x < c.minX) c.minX = x;
      if (y < c.minY) c.minY = y;
      if (x > c.maxX) c.maxX = x;
      if (y > c.maxY) c.maxY = y;
      c.sumX += x;
      c.sumY += y;
    }

    const filtered = Object.values(components)
      .filter(c => c.pixelCount >= minSpotSizePx)
      .map(c => {
        const centerX = c.sumX / c.pixelCount;
        const centerY = c.sumY / c.pixelCount;
        const radius = 0.5 * Math.max(c.maxX - c.minX + 1, c.maxY - c.minY + 1);
        return {
          id: c.id,
          pixelCount: c.pixelCount,
          centerX,
          centerY,
          radius,
        };
      });

    const res: DetectionResult = { width, height, components: filtered };
    setResult(res);
    setIsProcessing(false);
    drawOverlays(res);
  }, [imageElement, minContrastPercent, minSpotSizePx, drawOverlays]);

  useEffect(() => {
    if (!imageElement) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
  }, [imageElement]);

  useEffect(() => {
    if (!debouncedParams.imageUrl || !imageElement) return;
    analyze();
  }, [debouncedParams, imageElement, analyze]);

  const onReset = useCallback(() => {
    setImageUrl(null);
    setImageElement(null);
    setResult(null);
    const c = overlayCanvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    }
  }, []);

  const containerStyle = useMemo(
    () => ({ width: imageElement?.naturalWidth ?? 0, height: imageElement?.naturalHeight ?? 0 }),
    [imageElement]
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex flex-col">
          <label htmlFor="file" className="text-sm font-medium">
            Upload image
          </label>
          <input
            id="file"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="block w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700"
          />
        </div>
        
        <button
          type="button"
          onClick={onReset}
          className="h-10 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="minSpotSizePx" className="text-sm font-medium">
            Min spot size (pixels): {minSpotSizePx}
          </label>
          <input
            id="minSpotSizePx"
            type="range"
            min={1}
            max={Math.max(1, Math.floor((imageElement?.naturalWidth ?? 800) / 4))}
            step={1}
            value={minSpotSizePx}
            onChange={(e) => setMinSpotSizePx(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="minContrastPercent" className="text-sm font-medium">
            Min contrast (% of 255): {minContrastPercent}%
          </label>
          <input
            id="minContrastPercent"
            type="range"
            min={1}
            max={50}
            step={1}
            value={minContrastPercent}
            onChange={(e) => setMinContrastPercent(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {!imageElement && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Choose an image to begin.
          </p>
        )}
        {imageElement && (
          <div className="relative inline-block" style={containerStyle}>
            {/* Image as background layer */}
            {/* Using overlay canvas only; the image is drawn underneath via CSS background */}
            <div
              style={{
                width: imageElement.naturalWidth,
                height: imageElement.naturalHeight,
                backgroundImage: `url(${imageUrl ?? ""})`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
              }}
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute left-0 top-0"
              width={imageElement.naturalWidth}
              height={imageElement.naturalHeight}
              aria-label="Defect overlay"
            />
          </div>
        )}
        {isProcessing && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Processing…</p>
        )}
        {result && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Detected {result.components.length} component(s).
          </p>
        )}
      </div>

      {/* Hidden canvas for pixel processing */}
      <canvas ref={hiddenCanvasRef} className="hidden" aria-hidden="true" />
    </div>
  );
}


