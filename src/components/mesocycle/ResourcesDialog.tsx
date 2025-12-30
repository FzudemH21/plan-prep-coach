import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  FileSpreadsheet,
  Image,
  File,
  Upload,
  X,
  Download,
  Eye,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResourceFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  url: string;
}

interface ResourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resources: ResourceFile[];
  onAddResources: (files: File[]) => void;
  onDeleteResource: (id: string) => void;
}

const getFileIcon = (type: string) => {
  if (type.includes('pdf')) {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('xlsx') || type.includes('xls')) {
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  }
  if (type.includes('word') || type.includes('document') || type.includes('docx') || type.includes('doc')) {
    return <FileText className="h-5 w-5 text-blue-500" />;
  }
  if (type.startsWith('image/')) {
    return <Image className="h-5 w-5 text-purple-500" />;
  }
  return <File className="h-5 w-5 text-muted-foreground" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export const ResourcesDialog: React.FC<ResourcesDialogProps> = ({
  open,
  onOpenChange,
  resources,
  onAddResources,
  onDeleteResource,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onAddResources(files);
    }
  }, [onAddResources]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onAddResources(files);
    }
    // Reset input value to allow re-selecting the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onAddResources]);

  const handlePreview = (resource: ResourceFile) => {
    window.open(resource.url, '_blank');
  };

  const handleDownload = (resource: ResourceFile) => {
    const link = document.createElement('a');
    link.href = resource.url;
    link.download = resource.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Resources
          </DialogTitle>
          <DialogDescription>
            Upload and manage your training resources (PDFs, Excel, Word, images, etc.)
          </DialogDescription>
        </DialogHeader>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.svg"
          />
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">
            {isDragging ? "Drop files here" : "Drag and drop files here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Supported: PDF, Word, Excel, PowerPoint, Images
          </p>
        </div>

        {/* File List */}
        {resources.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Uploaded Files ({resources.length})</h4>
            <ScrollArea className="h-[200px] rounded-md border">
              <div className="p-2 space-y-2">
                {resources.map((resource) => (
                  <div
                    key={resource.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(resource.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{resource.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(resource.size)} • {formatDate(resource.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePreview(resource)}
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(resource)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDeleteResource(resource.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {resources.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            No resources uploaded yet. Drag and drop files or click to browse.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
