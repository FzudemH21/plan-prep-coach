/**
 * AthleteDocumentsTab
 *
 * Supports nested folders (create / delete), drag & drop upload,
 * inline viewing (PDF/images), and direct download for other file types.
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { InlineDocumentViewer } from "@/components/coach/InlineDocumentViewer";
import { useAthleteDocuments, type AthleteDoc, type DocFolder } from "@/hooks/useAthleteDocuments";
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
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
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
  if (type.includes("word") || type.includes("document")) return <FileText className={className} />;
  return <File className={className} />;
}

// ─── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
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
        "border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-colors",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40"
      )}
    >
      <Upload className={cn("h-5 w-5", isDragging ? "text-primary" : "text-muted-foreground")} />
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

// ─── Folder card ───────────────────────────────────────────────────────────────

function FolderCard({
  folder,
  docCount,
  onOpen,
  onDelete,
}: {
  folder: DocFolder;
  docCount: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      <Folder className="h-5 w-5 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{folder.name}</p>
        <p className="text-xs text-muted-foreground">
          {docCount} file{docCount !== 1 ? "s" : ""}
        </p>
      </div>
      <button
        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
        title="Delete folder"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Document row ──────────────────────────────────────────────────────────────

function DocRow({ doc, onOpen, onDelete }: { doc: AthleteDoc; onOpen: () => void; onDelete: () => void }) {
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
  const {
    getFolders,
    getFolderPath,
    getDocuments,
    addFolder,
    deleteFolder,
    addDocument,
    deleteDocument,
    getDocumentUrl,
    documents,
  } = useAthleteDocuments(athleteId);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<{ doc: AthleteDoc; url: string } | null>(null);

  // New folder input state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Delete confirmation
  const [deletingFolder, setDeletingFolder] = useState<DocFolder | null>(null);

  const breadcrumb = getFolderPath(currentFolderId);
  const subFolders = getFolders(currentFolderId);
  const currentDocs = getDocuments(currentFolderId);

  // Count all docs inside a folder (direct children only for the badge)
  const docCountInFolder = (folderId: string) =>
    documents.filter(d => d.folderId === folderId).length;

  const handleFiles = useCallback(
    async (files: File[]) => {
      setUploading(true);
      try {
        await Promise.all(files.map(f => addDocument(f, currentFolderId)));
        toast({ title: `${files.length} file${files.length > 1 ? "s" : ""} uploaded` });
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [addDocument, currentFolderId, toast]
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

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    addFolder(name, currentFolderId);
    setNewFolderName("");
    setCreatingFolder(false);
    toast({ title: `Folder "${name}" created` });
  };

  const handleDeleteFolder = (folder: DocFolder) => {
    setDeletingFolder(folder);
  };

  const confirmDeleteFolder = () => {
    if (!deletingFolder) return;
    deleteFolder(deletingFolder.id);
    // If we were inside this folder (or a descendant), go back to root
    if (currentFolderId === deletingFolder.id) setCurrentFolderId(null);
    toast({ title: `Folder "${deletingFolder.name}" deleted` });
    setDeletingFolder(null);
  };

  return (
    <div className="space-y-3 p-1 pr-4">

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Files uploaded here are accessible to the athlete in the Athlete App.
        </p>
        <div className="flex items-center gap-2">
          {uploading && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      {(breadcrumb.length > 0 || currentFolderId !== null) && (
        <div className="flex items-center gap-1 text-sm flex-wrap">
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setCurrentFolderId(null)}
          >
            All Files
          </button>
          {breadcrumb.map(f => (
            <span key={f.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                className={cn(
                  "hover:text-foreground transition-colors",
                  f.id === currentFolderId ? "text-foreground font-medium" : "text-muted-foreground"
                )}
                onClick={() => setCurrentFolderId(f.id)}
              >
                {f.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* New folder input */}
      {creatingFolder && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            placeholder="Folder name"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") setCreatingFolder(false);
            }}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
            Create
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCreatingFolder(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Delete folder confirmation */}
      {deletingFolder && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-center justify-between gap-3">
          <p className="text-sm">
            Delete <span className="font-medium">"{deletingFolder.name}"</span>?
            {" "}All files inside will be permanently deleted.
          </p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="destructive" onClick={confirmDeleteFolder}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setDeletingFolder(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Folders */}
      {subFolders.length > 0 && (
        <div className="space-y-1.5">
          {subFolders.map(folder => (
            <FolderCard
              key={folder.id}
              folder={folder}
              docCount={docCountInFolder(folder.id)}
              onOpen={() => setCurrentFolderId(folder.id)}
              onDelete={() => handleDeleteFolder(folder)}
            />
          ))}
        </div>
      )}

      {/* Documents */}
      {currentDocs.length > 0 && (
        <div className="space-y-1.5">
          {currentDocs.map(doc => (
            <DocRow
              key={doc.id}
              doc={doc}
              onOpen={() => handleOpen(doc)}
              onDelete={() => deleteDocument(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Drop zone — always visible */}
      <DropZone onFiles={handleFiles} disabled={uploading} />

      {/* Inline viewer */}
      <InlineDocumentViewer
        open={viewer !== null}
        doc={viewer ? { ...viewer.doc, folderId: viewer.doc.folderId ?? null, storagePath: viewer.doc.storagePath } : null}
        url={viewer?.url ?? null}
        onClose={() => setViewer(null)}
      />
    </div>
  );
}
