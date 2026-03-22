// src/components/document-image-viewer.tsx
"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";
import { Button } from "@/components/button";

interface DocumentImageViewerProps {
  src: string;
  alt?: string;
}

export function DocumentImageViewer({ src, alt = "Document" }: DocumentImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const isPdf = src.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(z + 0.25, 3))} icon={<ZoomIn className="h-4 w-4" />}>Zoom In</Button>
        <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))} icon={<ZoomOut className="h-4 w-4" />}>Zoom Out</Button>
        <Button variant="ghost" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)} icon={<RotateCw className="h-4 w-4" />}>Rotate</Button>
        <div className="flex-1" />
        <a href={src} download className="inline-flex">
          <Button variant="ghost" size="sm" icon={<Download className="h-4 w-4" />}>Download</Button>
        </a>
      </div>
      {/* Viewer */}
      <div className="flex-1 overflow-auto bg-[var(--muted)] flex items-center justify-center p-4">
        {isPdf ? (
          <iframe src={src} className="w-full h-full border-0 rounded-[var(--radius-card)]" title={alt} />
        ) : (
          <img
            src={src}
            alt={alt}
            className="max-w-full transition-transform duration-200"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          />
        )}
      </div>
    </div>
  );
}
