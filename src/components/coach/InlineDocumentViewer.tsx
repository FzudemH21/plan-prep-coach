/**
 * InlineDocumentViewer.tsx
 *
 * Full-screen dialog that previews documents directly in the app.
 *   - PDFs  → browser's built-in PDF viewer inside an <iframe>
 *   - Images → centred <img> with contain-fit
 *   - Other  → download fallback (file type not previewable)
 *
 * Toolbar: file name · size · "Open in new tab" · "Download" · close (X)
 */

import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, FileText, FileImage, File, Loader2, X } from "lucide-react";
import type { CoachDocument } from "@/hooks/useCoachDocuments";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  if (type.startsWith("image/")) return <FileImage className={className} />;
  if (type === "application/pdf") return <FileText className={className} />;
  return <File className={className} />;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface InlineDocumentViewerProps {
  open: boolean;
  doc: CoachDocument | null;
  url: string | null;
  onClose: () => void;
}

export function InlineDocumentViewer({
  open,
  doc,
  url,
  onClose,
}: InlineDocumentViewerProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  if (!doc) return null;

  const isPdf   = doc.type === "application/pdf";
  const isImage = doc.type.startsWith("image/");
  const isViewable = isPdf || isImage;

  const handleOpenNewTab = () => { if (url) window.open(url, "_blank"); };

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.click();
  };

  // Reset iframe-loaded state whenever the dialog opens a new document
  const handleOpenChange = (v: boolean) => {
    if (!v) { setIframeLoaded(false); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/*
        Override DialogContent sizing:
        - 92vw × 92vh, flex column, no default padding/gap
        - overflow-hidden so the iframe never leaks outside the dialog
      */}
      {/* [&>button]:hidden suppresses the floating default X that DialogContent
          auto-renders (it's the only direct-child <button>). Our X lives in
          the toolbar instead, so it never overlaps the download button. */}
      <DialogContent className="max-w-[92vw] w-[92vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden [&>button]:hidden">

        {/* Visually-hidden title for screen-reader accessibility */}
        <DialogTitle className="sr-only">{doc.name}</DialogTitle>

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background shrink-0">
          <TypeIcon type={doc.type} className="h-4 w-4 text-muted-foreground shrink-0" />

          {/* Name — truncates to available space */}
          <span className="font-medium text-sm truncate flex-1 min-w-0" title={doc.name}>
            {doc.name}
          </span>

          {/* Size */}
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            {formatBytes(doc.size)}
          </span>

          {/* Actions */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleOpenNewTab}
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Close">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>

        {/* ── Content area ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden bg-muted/20 relative">

          {/* ── PDF ── */}
          {isPdf && url && (
            <>
              {/* Spinner while iframe loads */}
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <iframe
                key={url}          /* remount when URL changes */
                src={url}
                title={doc.name}
                className="w-full h-full border-0"
                onLoad={() => setIframeLoaded(true)}
              />
            </>
          )}

          {/* ── Image ── */}
          {isImage && url && (
            <div className="w-full h-full flex items-center justify-center p-6">
              <img
                key={url}
                src={url}
                alt={doc.name}
                className="max-w-full max-h-full object-contain rounded-sm shadow"
              />
            </div>
          )}

          {/* ── No URL yet (still loading) ── */}
          {isViewable && !url && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* ── Unsupported type fallback ── */}
          {!isViewable && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <File className="h-14 w-14 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Preview not available for this file type.
              </p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
