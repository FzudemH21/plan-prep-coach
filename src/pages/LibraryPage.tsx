import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCustomLibraries } from '@/hooks/useCustomLibraries';
import { DynamicLibraryTable } from '@/components/templates/DynamicLibraryTable';

// Convert library name to URL-safe slug
const createSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// Find library by slug OR by direct ID match
const findLibraryBySlug = (libraries: any[], slug: string) => {
  // First try exact ID match (for built-in libraries)
  const byId = libraries.find(lib => lib.id === slug);
  if (byId) return byId;
  
  // Then try slug match from name
  return libraries.find(lib => createSlug(lib.name) === slug);
};

export default function LibraryPage() {
  const { libraryName } = useParams<{ libraryName: string }>();
  const navigate = useNavigate();
  const { libraries, isLoading } = useCustomLibraries();

  const library = findLibraryBySlug(libraries, libraryName || '');

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