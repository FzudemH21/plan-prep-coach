import { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCustomLibraries } from '@/hooks/useCustomLibraries';
import { DynamicLibraryTable } from '@/components/templates/DynamicLibraryTable';
import { WizardAIAssistant, type ApplySuggestion } from '@/components/wizard/WizardAIAssistant';

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
  const {
    libraries,
    isLoading,
    addExerciseToLibrary,
    updateExerciseInLibrary,
    deleteExerciseFromLibrary,
    addColumnToLibrary,
    deleteColumnFromLibrary,
  } = useCustomLibraries();

  const library = findLibraryBySlug(libraries, libraryName || '');

  // Auto-redirect to the overview when the library no longer exists (e.g. deleted)
  useEffect(() => {
    if (!isLoading && !library) {
      navigate('/templates', { replace: true });
    }
  }, [isLoading, library, navigate]);

  // Build AI context describing the current library state
  const buildLibraryContext = useCallback(() => {
    if (!library) return '';
    const columnLines = library.columns.map(
      c => `  - ${c.name} (id: ${c.id}, type: ${c.type}${c.options?.length ? ', options: ' + c.options.join('|') : ''}${c.role ? ', role: ' + c.role : ''})`
    );
    const exerciseLines = library.exercises.map(ex => {
      const fields = library.columns.map(c => {
        if (c.role === 'video') return `${c.name}: ${ex.videoUrl ?? ''}`;
        if (c.role === 'description') return `${c.name}: ${ex.description ?? ''}`;
        return `${c.name}: ${ex.data[c.id] ?? ''}`;
      });
      return `  - ${fields.join(' | ')} (id: ${ex.id})`;
    });
    return [
      `## Current Library: ${library.name}`,
      `Library ID: ${library.id}`,
      `Description: ${library.description || '(none)'}`,
      ``,
      `### Library Columns (${library.columns.length})`,
      columnLines.length > 0 ? columnLines.join('\n') : '  (none)',
      ``,
      `### Exercises (${library.exercises.length})`,
      exerciseLines.length > 0 ? exerciseLines.join('\n') : '  (none)',
    ].join('\n');
  }, [library]);

  const handleAIApply = useCallback((action: ApplySuggestion) => {
    if (!library) return;

    if (action.type === 'library_add_exercise') {
      if (action.libraryId !== library.id) return;
      addExerciseToLibrary(library.id, {
        data: action.data ?? {},
        description: action.description,
        videoUrl: action.videoUrl,
      });
    }

    else if (action.type === 'library_delete_exercise') {
      if (action.libraryId !== library.id) return;
      const exerciseId = action.exerciseId
        ?? library.exercises.find(e => e.data[library.columns[0]?.id] === action.exerciseName)?.id;
      if (exerciseId) deleteExerciseFromLibrary(library.id, exerciseId);
    }

    else if (action.type === 'library_update_exercise') {
      if (action.libraryId !== library.id) return;
      const exerciseId = action.exerciseId
        ?? library.exercises.find(e => e.data[library.columns[0]?.id] === action.exerciseName)?.id;
      if (!exerciseId) return;
      const ex = library.exercises.find(e => e.id === exerciseId);
      if (!ex) return;
      // Map column names in updates → column ids
      const dataUpdates: Record<string, string> = { ...ex.data };
      for (const [colName, val] of Object.entries(action.updates ?? {})) {
        const col = library.columns.find(c => c.name === colName);
        if (col && col.role !== 'video' && col.role !== 'description') {
          dataUpdates[col.id] = val;
        }
      }
      updateExerciseInLibrary(library.id, exerciseId, {
        data: dataUpdates,
        ...(action.description !== undefined ? { description: action.description } : {}),
        ...(action.videoUrl !== undefined ? { videoUrl: action.videoUrl } : {}),
      });
    }

    else if (action.type === 'library_add_column') {
      if (action.libraryId !== library.id) return;
      addColumnToLibrary(library.id, {
        name: action.name,
        type: action.columnType,
        required: false,
        options: action.options ?? [],
      });
    }

    else if (action.type === 'library_delete_column') {
      if (action.libraryId !== library.id) return;
      const columnId = action.columnId
        ?? library.columns.find(c => c.name === action.columnName)?.id;
      if (columnId) deleteColumnFromLibrary(library.id, columnId);
    }
  }, [library, addExerciseToLibrary, updateExerciseInLibrary, deleteExerciseFromLibrary, addColumnToLibrary, deleteColumnFromLibrary]);

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

      <WizardAIAssistant
        stepLabel={`Exercise Library — ${library.name}`}
        wizardContext={buildLibraryContext()}
        assistantRole={`You are an expert strength & conditioning assistant helping a coach manage their Exercise Library called "${library.name}". You can add, update, or delete exercises and columns in this library. Always use the exact column names, exercise IDs, and library ID shown in context. When adding exercises, infer sensible values for all listed columns based on the exercise name and type. When deleting exercises or columns, always confirm with the coach first since this is irreversible.`}
        onApplySuggestion={handleAIApply}
      />
    </div>
  );
}
