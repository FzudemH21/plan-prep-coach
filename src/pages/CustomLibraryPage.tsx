import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCustomLibraries } from '@/hooks/useCustomLibraries';
import { DynamicLibraryTable } from '@/components/templates/DynamicLibraryTable';
import { useToast } from '@/hooks/use-toast';

export default function CustomLibraryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { libraries, isLoading } = useCustomLibraries();
  const { toast } = useToast();

  const library = libraries.find(lib => lib.id === id);

  if (isLoading) {
    return (
      <div className="w-full max-w-none space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-4"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!library) {
    return (
      <div className="w-full max-w-none space-y-8">
        <div className="flex items-center space-x-4 mb-8">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/templates")}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Templates</span>
          </Button>
        </div>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Library Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The library you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => navigate("/templates")}>
            Return to Templates
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-8">
      <div className="flex items-center space-x-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate("/templates")}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Templates</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{library.name}</h1>
          <p className="text-muted-foreground">{library.description}</p>
        </div>
      </div>

      <DynamicLibraryTable library={library} />
    </div>
  );
}