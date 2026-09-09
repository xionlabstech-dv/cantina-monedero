"use client";

export function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 text-white flex items-center justify-center text-2xl leading-none hover:bg-white/20"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
      />
    </div>
  );
}
