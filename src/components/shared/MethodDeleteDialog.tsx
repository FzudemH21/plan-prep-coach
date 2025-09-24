import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface MethodDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  methodName: string;
  isManualMethod: boolean;
}

export const MethodDeleteDialog = ({ isOpen, onClose, onConfirm, methodName, isManualMethod }: MethodDeleteDialogProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Training Method</AlertDialogTitle>
          <AlertDialogDescription>
            {isManualMethod ? (
              <>Are you sure you want to delete "{methodName}"? This method was manually added and will be completely removed from your training plan.</>
            ) : (
              <>Are you sure you want to remove "{methodName}" from your training plan? This method was allocated based on your sub-goals and removing it may affect your sub-goal coverage.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Method
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};