/**
 * AthleteDocumentsTab
 *
 * Shows all documents uploaded for a specific athlete.
 * Supports drag & drop upload, inline viewing (PDF/images),
 * and direct download for other file types.
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { InlineDocumentViewer } from "@/components/coach/InlineDocumentViewer";
import { useAthleteDocuments, type AthleteDoc } from "@/hooks/useAthleteDocuments";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Upload,
  Trash2,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  File,
  Eye,
  Download,
  Loader2,
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type, className }: { type: string; className?: string }) {
  if (type.startsWith("image/")) return <FileImage className={className} />;
  if (type.startsWith("video/")) return <FileVideo className={className} />;
  if (type.startsWith("audio/")) return <FileAudio className={className} />;
  if (type === "application/pdf") return <FileText className={className} />;
  if (type.includes("word") || type.includes("document"))
    return <FileText className={className} />;
  return <File className={className} />;
}

// ─── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 transition-colors",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40"
      )}
    >
      <Upload className={cn("h-6 w-6", isDragging ? "text-primary" : "text-muted-foreground")} />
      <p className="text-sm font-medium">Drop files here</p>
      <p className="text-xs text-muted-foreground">or click to select — all file types</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Document row ──────────────────────────────────────────────────────────────

function DocRow({
  doc,
  onOpen,
  onDelete,
}: {
  doc: AthleteDoc;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isViewable = doc.type.startsWith("image/") || doc.type === "application/pdf";

  return (
    <div
      className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      <FileIcon type={doc.type} className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(doc.size)} · {format(new Date(doc.uploadedAt), "dd.MM.yyyy")}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {isViewable
          ? <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          : <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        }
        <button
          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
          title="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function AthleteDocumentsTab({ athleteId }: { athleteId: string }) {
  const { toast } = useToast();
  const { docs, addDocument, deleteDocument, getDocumentUrl } = useAthleteDocuments(athleteId);

  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<{ doc: AthleteDoc; url: string } | null>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      setUploading(true);
      try {
        await Promise.all(files.map((f) => addDocument(f)));
        toast({
          title: `${files.length} file${files.length > 1 ? "s" : ""} uploaded`,
        });
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [addDocument, toast]
  );

  const handleOpen = useCallback(
    async (doc: AthleteDoc) => {
      const isViewable = doc.type.startsWith("image/") || doc.type === "application/pdf";
      if (!isViewable) {
        const url = await getDocumentUrl(doc.id);
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.name;
        a.click();
        return;
      }
      setViewer({ doc, url: "" });
      const url = await getDocumentUrl(doc.id);
      if (!url) { setViewer(null); return; }
      setViewer({ doc, url });
    },
    [getDocumentUrl]
  );

  return (
    <div className="space-y-4 p-1 pr-4">
      {/* Upload area */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Files uploaded here are accessible to the athlete in the Athlete App.
        </p>
        {uploading && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <DropZone onFiles={handleFiles} disabled={uploading} />
      ) : (
        <>
          <div className="space-y-1.5">
            {docs.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                onOpen={() => handleOpen(doc)}
                onDelete={() => deleteDocument(doc.id)}
              />
            ))}
          </div>

          {/* Upload more button */}
          <DropZone onFiles={handleFiles} disabled={uploading} />
        </>
      )}

      {/* Inline viewer */}
      <InlineDocumentViewer
        open={viewer !== null}
        doc={viewer ? { ...viewer.doc, folderId: null, storagePath: viewer.doc.storagePath } : null}
        url={viewer?.url ?? null}
        onClose={() => setViewer(null)}
      />
    </div>
  );
}
