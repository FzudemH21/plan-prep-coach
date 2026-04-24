import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";
import { ResourcesDialog } from "@/components/mesocycle/ResourcesDialog";
import { useCoachDocuments } from "@/hooks/useCoachDocuments";

export function ResourcesButton() {
  const [open, setOpen] = useState(false);
  const { documents } = useCoachDocuments();

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FolderOpen className="h-4 w-4 mr-2" />
        Resources
        {documents.length > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 px-1.5">
            {documents.length}
          </Badge>
        )}
      </Button>
      <ResourcesDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
