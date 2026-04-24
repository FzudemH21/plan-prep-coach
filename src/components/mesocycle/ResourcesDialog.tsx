import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog as InnerDialog,
  DialogContent as InnerDialogContent,
  DialogFooter as InnerDialogFooter,
  DialogHeader as InnerDialogHeader,
  DialogTitle as InnerDialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useCoachDocuments, type DocFolder, type CoachDocument } from '@/hooks/useCoachDocuments';
import {
  Folder,
  FolderPlus,
  Upload,
  MoreVertical,
  Download,
  Trash2,
  Pencil,
  FolderInput,
  ChevronRight,
  Home,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  File,
  GripVertical,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type, className }: { type: string; className?: string }) {
  if (type.startsWith('image/')) return <FileImage className={className} />;
  if (type.startsWith('video/')) return <FileVideo className={className} />;
  if (type.startsWith('audio/')) return <FileAudio className={className} />;
  if (type === 'application/pdf') return <FileText className={className} />;
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv'))
    return <FileSpreadsheet className={className} />;
  if (type.includes('word') || type.includes('document'))
    return <FileText className={className} />;
  return <File className={className} />;
}

// ─────────────────────────────────────────────
// Breadcrumb
// ─────────────────────────────────────────────

function Breadcrumb({
  path,
  onNavigate,
}: {
  path: DocFolder[];
  onNavigate: (id: string | null) => void;
}) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onNavigate(null)}
      >
        <Home className="h-3.5 w-3.5" />
        <span>Resources</span>
      </button>
      {path.map((f) => (
        <span key={f.id} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <button
            className="hover:text-foreground transition-colors truncate max-w-[140px]"
            onClick={() => onNavigate(f.id)}
          >
            {f.name}
          </button>
        </span>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────
// Folder card (drop target)
// ─────────────────────────────────────────────

interface FolderCardProps {
  folder: DocFolder;
  docCount: number;
  isDropTarget: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function FolderCard({
  folder, docCount, isDropTarget,
  onOpen, onRename, onDelete,
  onDragOver, onDragLeave, onDrop,
}: FolderCardProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-card px-3 py-2 hover:bg-accent/50 transition-colors cursor-pointer',
        isDropTarget && 'ring-2 ring-primary bg-primary/5 border-primary',
      )}
      onClick={onOpen}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Folder className={cn('h-7 w-7 shrink-0', isDropTarget ? 'text-primary' : 'text-primary/70')} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{folder.name}</p>
        <p className="text-xs text-muted-foreground">
          {docCount} {docCount === 1 ? 'document' : 'documents'}
          {isDropTarget && <span className="ml-2 text-primary font-medium">Drop here</span>}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
            <Pencil className="h-4 w-4 mr-2" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─────────────────────────────────────────────
// Document row (draggable, openable)
// ─────────────────────────────────────────────

interface DocRowProps {
  doc: CoachDocument;
  onOpen: () => void;
  onMove: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function DocRow({ doc, onOpen, onMove, onDelete, onDragStart, onDragEnd }: DocRowProps) {
  const dragFromHandle = useRef(false);

  return (
    <div
      className="group flex items-center gap-2 rounded-lg border bg-card px-2 py-2 hover:bg-accent/50 transition-colors cursor-pointer"
      draggable
      onDragStart={(e) => {
        if (!dragFromHandle.current) { e.preventDefault(); return; }
        onDragStart(e);
      }}
      onDragEnd={() => { dragFromHandle.current = false; onDragEnd(); }}
      onClick={() => onOpen()}
    >
      {/* Drag handle – hover only */}
      <div
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0"
        onMouseDown={(e) => { e.stopPropagation(); dragFromHandle.current = true; }}
        onMouseUp={() => { dragFromHandle.current = false; }}
        onClick={(e) => e.stopPropagation()}
        title="Drag to move"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <FileIcon type={doc.type} className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(doc.size)} · {format(new Date(doc.uploadedAt), 'dd.MM.yyyy')}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onMove}>
              <FolderInput className="h-4 w-4 mr-2" /> Move
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Move dialog
// ─────────────────────────────────────────────

function MoveDialog({
  doc, allFolders, onMove, onClose,
}: {
  doc: CoachDocument | null;
  allFolders: DocFolder[];
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(doc?.folderId ?? null);
  return (
    <InnerDialog open={!!doc} onOpenChange={(o) => { if (!o) onClose(); }}>
      <InnerDialogContent>
        <InnerDialogHeader>
          <InnerDialogTitle>Move document</InnerDialogTitle>
        </InnerDialogHeader>
        <p className="text-sm text-muted-foreground mb-2">
          Target folder for <span className="font-medium">{doc?.name}</span>:
        </p>
        <ScrollArea className="max-h-52 border rounded-md p-2 space-y-1">
          <button
            className={cn('w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent transition-colors', selected === null && 'bg-accent')}
            onClick={() => setSelected(null)}
          >
            <Home className="h-4 w-4 text-muted-foreground" /> Root
          </button>
          {allFolders.map((f) => (
            <button
              key={f.id}
              className={cn('w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent transition-colors', selected === f.id && 'bg-accent')}
              onClick={() => setSelected(f.id)}
            >
              <Folder className="h-4 w-4 text-muted-foreground" /> {f.name}
            </button>
          ))}
          {allFolders.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1">No folders yet.</p>
          )}
        </ScrollArea>
        <InnerDialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onMove(selected); onClose(); }}>Move</Button>
        </InnerDialogFooter>
      </InnerDialogContent>
    </InnerDialog>
  );
}

// ─────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────

interface ResourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ResourcesDialog: React.FC<ResourcesDialogProps> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const {
    folders,
    getFolders,
    getFolderPath,
    getDocuments,
    addFolder,
    renameFolder,
    deleteFolder,
    addDocument,
    deleteDocument,
    moveDocument,
    getDocumentUrl,
  } = useCoachDocuments();

  const handleDocOpen = useCallback(async (doc: CoachDocument) => {
    const url = await getDocumentUrl(doc.id);
    if (!url) return;
    const viewable = doc.type.startsWith('image/') || doc.type === 'application/pdf';
    if (viewable) {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
    }
  }, [getDocumentUrl]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Navigation ──────────────────────────────
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const breadcrumbPath = getFolderPath(currentFolderId);
  const currentFolders = getFolders(currentFolderId);
  const currentDocs = getDocuments(currentFolderId);

  // ── Drag & drop ─────────────────────────────
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const handleDocDragStart = useCallback((e: React.DragEvent, docId: string) => {
    setDraggingDocId(docId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', docId);
  }, []);

  const handleDocDragEnd = useCallback(() => {
    setDraggingDocId(null);
    setDragOverFolderId(null);
  }, []);

  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    if (!draggingDocId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  }, [draggingDocId]);

  const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverFolderId(null);
    }
  }, []);

  const handleFolderDrop = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const docId = e.dataTransfer.getData('text/plain') || draggingDocId;
    if (docId) {
      moveDocument(docId, folderId);
      toast({ title: 'Document moved' });
    }
    setDraggingDocId(null);
    setDragOverFolderId(null);
  }, [draggingDocId, moveDocument, toast]);

  // ── Upload drag ──────────────────────────────
  const [isUploadDragging, setIsUploadDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      await Promise.all(files.map((f) => addDocument(f, currentFolderId)));
      toast({ title: `${files.length} file${files.length > 1 ? 's' : ''} uploaded` });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [addDocument, currentFolderId, toast]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      uploadFiles(Array.from(e.target.files ?? []));
    },
    [uploadFiles],
  );

  const handleUploadDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsUploadDragging(false);
    // Only handle if not a doc-to-folder drag
    if (draggingDocId) return;
    uploadFiles(Array.from(e.dataTransfer.files));
  }, [draggingDocId, uploadFiles]);

  // ── Folder dialogs ───────────────────────────
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DocFolder | null>(null);
  const [renameName, setRenameName] = useState('');

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    addFolder(name, currentFolderId);
    setNewFolderName('');
    setShowNewFolder(false);
    toast({ title: 'Folder created' });
  };

  const handleRename = () => {
    if (!renameTarget || !renameName.trim()) return;
    renameFolder(renameTarget.id, renameName);
    setRenameTarget(null);
    toast({ title: 'Folder renamed' });
  };

  // ── Delete ───────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<
    { type: 'folder'; item: DocFolder } | { type: 'doc'; item: CoachDocument } | null
  >(null);

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'folder') {
      if (currentFolderId === deleteTarget.item.id) setCurrentFolderId(null);
      deleteFolder(deleteTarget.item.id);
      toast({ title: 'Folder deleted' });
    } else {
      deleteDocument(deleteTarget.item.id);
      toast({ title: 'Document deleted' });
    }
    setDeleteTarget(null);
  };

  // ── Move dialog ──────────────────────────────
  const [moveTarget, setMoveTarget] = useState<CoachDocument | null>(null);

  const isEmpty = currentFolders.length === 0 && currentDocs.length === 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                Resources
              </DialogTitle>
              {/* Toolbar */}
              <div className="flex items-center gap-2 mr-6">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setShowNewFolder(true)}
                >
                  <FolderPlus className="h-4 w-4 mr-1.5" />
                  New Folder
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  {uploading ? 'Uploading…' : 'Upload'}
                </Button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
              </div>
            </div>
            {/* Breadcrumb */}
            <Breadcrumb path={breadcrumbPath} onNavigate={setCurrentFolderId} />
          </DialogHeader>

          {/* Content */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div
              className="space-y-1.5 pb-4"
              onDragOver={(e) => { if (!draggingDocId) { e.preventDefault(); setIsUploadDragging(true); } }}
              onDragLeave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setIsUploadDragging(false); }}
              onDrop={handleUploadDrop}
            >
              {/* Upload drag overlay hint */}
              {isUploadDragging && !draggingDocId && (
                <div className="border-2 border-dashed border-primary bg-primary/5 rounded-lg p-6 text-center text-sm text-primary font-medium">
                  Drop files to upload to current folder
                </div>
              )}

              {/* Empty state */}
              {isEmpty && !isUploadDragging && (
                <div className="text-center py-10 text-muted-foreground">
                  <Folder className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{currentFolderId ? 'This folder is empty.' : 'No resources yet.'}</p>
                  <p className="text-xs mt-1">Upload files or create a folder.</p>
                </div>
              )}

              {/* Folders */}
              {currentFolders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  docCount={getDocuments(folder.id).length}
                  isDropTarget={dragOverFolderId === folder.id}
                  onOpen={() => setCurrentFolderId(folder.id)}
                  onRename={() => { setRenameTarget(folder); setRenameName(folder.name); }}
                  onDelete={() => setDeleteTarget({ type: 'folder', item: folder })}
                  onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                  onDragLeave={handleFolderDragLeave}
                  onDrop={(e) => handleFolderDrop(e, folder.id)}
                />
              ))}

              {currentFolders.length > 0 && currentDocs.length > 0 && (
                <div className="border-t my-2" />
              )}

              {/* Documents */}
              {currentDocs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  onOpen={() => handleDocOpen(doc)}
                  onMove={() => setMoveTarget(doc)}
                  onDelete={() => setDeleteTarget({ type: 'doc', item: doc })}
                  onDragStart={(e) => handleDocDragStart(e, doc.id)}
                  onDragEnd={handleDocDragEnd}
                />
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── New folder ── */}
      <InnerDialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <InnerDialogContent>
          <InnerDialogHeader>
            <InnerDialogTitle>New Folder</InnerDialogTitle>
          </InnerDialogHeader>
          <Input
            placeholder="Folder name…"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
            autoFocus
          />
          <InnerDialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
          </InnerDialogFooter>
        </InnerDialogContent>
      </InnerDialog>

      {/* ── Rename folder ── */}
      <InnerDialog open={!!renameTarget} onOpenChange={(o) => { if (!o) setRenameTarget(null); }}>
        <InnerDialogContent>
          <InnerDialogHeader>
            <InnerDialogTitle>Rename Folder</InnerDialogTitle>
          </InnerDialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
            autoFocus
          />
          <InnerDialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameName.trim()}>Rename</Button>
          </InnerDialogFooter>
        </InnerDialogContent>
      </InnerDialog>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'folder' ? 'Delete folder?' : 'Delete document?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'folder'
                ? `"${deleteTarget.item.name}" and all documents inside will be permanently deleted.`
                : `"${deleteTarget?.item.name}" will be permanently deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Move dialog ── */}
      <MoveDialog
        doc={moveTarget}
        allFolders={folders}
        onMove={(folderId) => {
          if (moveTarget) {
            moveDocument(moveTarget.id, folderId);
            toast({ title: 'Document moved' });
          }
        }}
        onClose={() => setMoveTarget(null)}
      />
    </>
  );
};
