import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Pencil, Check, X } from 'lucide-react';
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
    editLibrary,
    addExerciseToLibrary,
    updateExerciseInLibrary,
    batchUpdateExercisesInLibrary,
    deleteExerciseFromLibrary,
    addColumnToLibrary,
    deleteColumnFromLibrary,
  } = useCustomLibraries();

  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const library = findLibraryBySlug(libraries, libraryName || '');

  // Auto-redirect to the overview when the library no longer exists (e.g. deleted)
  useEffect(() => {
    if (!isLoading && !library) {
      navigate('/templates/exercise-libraries', { replace: true });
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
      // AI may send column names or column IDs as keys — accept both
      const mappedData: Record<string, string> = {};
      for (const [key, val] of Object.entries(action.data ?? {})) {
        const col = library.columns.find(c => c.name === key) ?? library.columns.find(c => c.id === key);
        if (col && col.role !== 'video' && col.role !== 'description') {
          mappedData[col.id] = val;
        }
      }
      addExerciseToLibrary(library.id, {
        data: mappedData,
        description: action.description,
        videoUrl: action.videoUrl,
      });
    }

    else if (action.type === 'library_delete_exercise') {
      if (action.libraryId !== library.id) return;
      // IDs may be stored as numbers; use string coercion to match
      const exerciseId = action.exerciseId
        ? library.exercises.find(e => String(e.id) === String(action.exerciseId))?.id
        : library.exercises.find(e => e.data[library.columns[0]?.id] === action.exerciseName)?.id;
      if (exerciseId) deleteExerciseFromLibrary(library.id, exerciseId);
    }

    else if (action.type === 'library_update_exercise') {
      if (action.libraryId !== library.id) return;
      // IDs may be stored as numbers; use string coercion to match
      const ex = action.exerciseId
        ? library.exercises.find(e => String(e.id) === String(action.exerciseId))
        : library.exercises.find(e => e.data[library.columns[0]?.id] === action.exerciseName);
      const exerciseId = ex?.id;
      if (!ex) return;
      // Map column names OR column IDs in updates → column ids
      const dataUpdates: Record<string, string> = { ...ex.data };
      for (const [key, val] of Object.entries(action.updates ?? {})) {
        const col = library.columns.find(c => c.name === key) ?? library.columns.find(c => c.id === key);
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

  // Batch handler — resolves all actions in one save to avoid stale-closure overwrite
  const handleAIApplyAll = useCallback((actions: ApplySuggestion[]) => {
    if (!library) return;

    // Group library_update_exercise actions into a single batchUpdate call
    const updateActions = actions.filter(
      (a): a is Extract<ApplySuggestion, { type: 'library_update_exercise' }> =>
        a.type === 'library_update_exercise' && a.libraryId === library.id
    );
    if (updateActions.length > 0) {
      const batchUpdates = updateActions.flatMap(action => {
        const ex = action.exerciseId
          ? library.exercises.find(e => String(e.id) === String(action.exerciseId))
          : library.exercises.find(e => e.data[library.columns[0]?.id] === action.exerciseName);
        if (!ex) return [];
        const dataUpdates: Record<string, string> = { ...ex.data };
        for (const [key, val] of Object.entries(action.updates ?? {})) {
          const col = library.columns.find(c => c.name === key) ?? library.columns.find(c => c.id === key);
          if (col && col.role !== 'video' && col.role !== 'description') {
            dataUpdates[col.id] = val;
          }
        }
        return [{
          exerciseId: String(ex.id),
          data: dataUpdates,
          ...(action.description !== undefined ? { description: action.description } : {}),
          ...(action.videoUrl !== undefined ? { videoUrl: action.videoUrl } : {}),
        }];
      });
      if (batchUpdates.length > 0) batchUpdateExercisesInLibrary(library.id, batchUpdates);
    }

    // Handle all non-update actions individually (these are rare, not subject to stale-write)
    const otherActions = actions.filter(a => a.type !== 'library_update_exercise');
    otherActions.forEach(handleAIApply);
  }, [library, batchUpdateExercisesInLibrary, handleAIApply]);

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
            onClick={() => navigate("/templates/exercise-libraries")}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Exercise Libraries</span>
          </Button>
        </div>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Library Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The library you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => navigate("/templates/exercise-libraries")}>
            Return to Exercise Libraries
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
          onClick={() => navigate("/templates/exercise-libraries")}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Exercise Libraries</span>
        </Button>
        {isEditingMeta ? (
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-1 space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-xl font-bold h-10"
                placeholder="Library name"
                autoFocus
              />
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="resize-none text-sm"
                placeholder="Description (optional)"
                rows={2}
              />
            </div>
            <div className="flex gap-1 mt-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => {
                  if (editName.trim()) {
                    editLibrary(library.id, { name: editName.trim(), description: editDesc.trim() });
                  }
                  setIsEditingMeta(false);
                }}
              >
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setIsEditingMeta(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <div>
              <h1 className="text-3xl font-bold">{library.name}</h1>
              {library.description && <p className="text-muted-foreground">{library.description}</p>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
              onClick={() => { setEditName(library.name); setEditDesc(library.description || ''); setIsEditingMeta(true); }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <DynamicLibraryTable library={library} />

      <WizardAIAssistant
        stepLabel={`Exercise Library — ${library.name}`}
        wizardContext={buildLibraryContext()}
        assistantRole={`You are an expert strength & conditioning assistant helping a coach manage their Exercise Library called "${library.name}". You can add, update, or delete exercises and columns in this library. Always use the exact column names, exercise IDs, and library ID shown in context. When adding exercises, infer sensible values for all listed columns based on the exercise name and type. When deleting exercises or columns, always confirm with the coach first since this is irreversible.`}
        onApplySuggestion={handleAIApply}
        onApplyAll={handleAIApplyAll}
      />
    </div>
  );
}
