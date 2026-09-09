"use client";

import { useEffect, useRef, useState } from "react";

const FRAME = 260;
const OUTPUT = 640;

interface Dims {
  w: number;
  h: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function calcDisp(natural: Dims, zoom: number) {
  const baseScale = FRAME / Math.min(natural.w, natural.h);
  const scale = baseScale * zoom;
  return { dispW: natural.w * scale, dispH: natural.h * scale };
}

function clampOffset(offset: { x: number; y: number }, dispW: number, dispH: number) {
  return {
    x: clamp(offset.x, FRAME - dispW, 0),
    y: clamp(offset.y, FRAME - dispH, 0),
  };
}

export function PhotoCropper({
  file,
  onConfirm,
  onCancel,
}: {
  file: File;
  onConfirm: (recortado: File) => void;
  onCancel: () => void;
}) {
  const [src] = useState(() => URL.createObjectURL(file));
  const [natural, setNatural] = useState<Dims | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const draggingRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  useEffect(() => {
    return () => URL.revokeObjectURL(src);
  }, [src]);

  function handleImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    const dims = { w: img.naturalWidth, h: img.naturalHeight };
    setNatural(dims);
    const { dispW, dispH } = calcDisp(dims, 1);
    setOffset({ x: (FRAME - dispW) / 2, y: (FRAME - dispH) / 2 });
    setZoom(1);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || !natural) return;
    const { dispW, dispH } = calcDisp(natural, zoom);
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    setOffset(
      clampOffset(
        { x: draggingRef.current.startOffsetX + dx, y: draggingRef.current.startOffsetY + dy },
        dispW,
        dispH
      )
    );
  }

  function onPointerUp() {
    draggingRef.current = null;
  }

  function onZoomChange(value: number) {
    if (!natural) return;
    setZoom(value);
    const { dispW, dispH } = calcDisp(natural, value);
    setOffset((prev) => clampOffset(prev, dispW, dispH));
  }

  function confirmar() {
    if (!natural || !imgRef.current) return;
    const k = OUTPUT / FRAME;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { dispW, dispH } = calcDisp(natural, zoom);
    ctx.drawImage(
      imgRef.current,
      0,
      0,
      natural.w,
      natural.h,
      offset.x * k,
      offset.y * k,
      dispW * k,
      dispH * k
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onConfirm(new File([blob], "recorte.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  const dispSize = natural ? calcDisp(natural, zoom) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="ticket p-5 w-full max-w-xs flex flex-col items-center gap-4">
        <p className="text-sm font-medium text-ink self-start">
          Ajusta la foto — arrastra para mover
        </p>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ width: FRAME, height: FRAME, touchAction: "none" }}
          className="relative rounded-full overflow-hidden border border-line bg-paper cursor-move select-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt="Foto a recortar"
            onLoad={handleImgLoad}
            draggable={false}
            style={
              dispSize
                ? {
                    position: "absolute",
                    left: offset.x,
                    top: offset.y,
                    width: dispSize.dispW,
                    height: dispSize.dispH,
                    maxWidth: "none",
                  }
                : { opacity: 0 }
            }
          />
        </div>

        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          disabled={!natural}
          className="w-full"
          aria-label="Zoom"
        />

        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={confirmar}
            disabled={!natural}
            className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-60"
          >
            Usar foto
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-line text-sm text-ink-soft"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
