import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";
import { ResourcesDialog } from "@/components/mesocycle/ResourcesDialog";
import { useCoachDocuments } from "@/hooks/useCoachDocuments";

export function ResourcesButton() {
  const [open, setOpen] = useState(false);
  const { documents, folders } = useCoachDocuments();
  // Only count documents that are actually reachable in the UI:
  //   • storagePath must be set (rules out legacy v1 entries)
  //   • folderId is null (root) OR points to a folder that still exists
  //     (orphaned docs whose parent folder was deleted are invisible but
  //      would otherwise inflate the badge)
  const folderIds = new Set(folders.map((f) => f.id));
  const reachableCount = documents.filter(
    (d) => d.storagePath && (d.folderId === null || folderIds.has(d.folderId))
  ).length;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FolderOpen className="h-4 w-4 mr-2" />
        Resources
        {reachableCount > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 px-1.5">
            {reachableCount}
          </Badge>
        )}
      </Button>
      <ResourcesDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
