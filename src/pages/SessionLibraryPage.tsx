import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  BookmarkPlus,
  Plus,
  Search,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Settings2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSessionLibrary } from '@/hooks/useSessionLibrary';
import { SessionDetailModal } from '@/components/session-library/SessionDetailModal';
import type { SessionLibraryEntry, SessionLibraryColumn } from '@/types/sessionLibrary';

// ── Add-Column Dialog ──────────────────────────────────────────────────────────

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (col: Omit<SessionLibraryColumn, 'id'>) => void;
}

function AddColumnDialog({ open, onOpenChange, onAdd }: AddColumnDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<SessionLibraryColumn['type']>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);

  const reset = () => {
    setName('');
    setType('text');
    setOptions('');
    setRequired(false);
  };

  const handleAdd = () => {
    onAdd({
      name: name.trim(),
      type,
      required,
      options:
        type === 'select'
          ? options
              .split('\n')
              .map(o => o.trim())
              .filter(Boolean)
          : undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('sessionLibrary.columnDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>{t('sessionLibrary.columnDialog.title')}</Label>
            <Input
              placeholder={t('sessionLibrary.columnDialog.namePlaceholder')}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('sessionLibrary.columnDialog.type')}</Label>
            <Select
              value={type}
              onValueChange={v => setType(v as SessionLibraryColumn['type'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">
                  {t('sessionLibrary.columnDialog.typeText')}
                </SelectItem>
                <SelectItem value="select">
                  {t('sessionLibrary.columnDialog.typeSelect')}
                </SelectItem>
                <SelectItem value="textarea">
                  {t('sessionLibrary.columnDialog.typeTextarea')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'select' && (
            <div className="space-y-1.5">
              <Label>{t('sessionLibrary.columnDialog.options')}</Label>
              <Textarea
                placeholder={'Option A\nOption B\nOption C'}
                value={options}
                onChange={e => setOptions(e.target.value)}
                className="min-h-[80px] resize-y"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="col-required"
              checked={required}
              onCheckedChange={v => setRequired(!!v)}
            />
            <Label htmlFor="col-required" className="cursor-pointer">
              {t('sessionLibrary.columnDialog.required')}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleAdd} disabled={!name.trim()}>
            {t('sessionLibrary.columnDialog.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null;

export default function SessionLibraryPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const {
    entries,
    columns,
    addColumn,
    removeColumn,
    deleteEntry,
    duplicateEntry,
  } = useSessionLibrary();

  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const [addColOpen, setAddColOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<SessionLibraryEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Sort ───────────────────────────────────────────────────────────────────

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortCol(null);
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortCol === col ? (
      sortDir === 'asc' ? (
        <ChevronUp className="h-3 w-3 ml-1 inline" />
      ) : (
        <ChevronDown className="h-3 w-3 ml-1 inline" />
      )
    ) : null;

  // ── Filtered + sorted entries ──────────────────────────────────────────────

  const displayed = useMemo(() => {
    let list = [...entries];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        e =>
          e.name.toLowerCase().includes(q) ||
          (e.method ?? '').toLowerCase().includes(q) ||
          columns.some(c =>
            (e.columnValues[c.id] ?? '').toLowerCase().includes(q)
          )
      );
    }

    if (sortCol && sortDir) {
      list.sort((a, b) => {
        let va = '';
        let vb = '';
        if (sortCol === 'name') { va = a.name; vb = b.name; }
        else if (sortCol === 'method') { va = a.method ?? ''; vb = b.method ?? ''; }
        else if (sortCol === 'exercises') {
          va = String(a.exercises.length).padStart(5, '0');
          vb = String(b.exercises.length).padStart(5, '0');
        } else if (sortCol === 'createdAt') { va = a.createdAt; vb = b.createdAt; }
        else { va = a.columnValues[sortCol] ?? ''; vb = b.columnValues[sortCol] ?? ''; }
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }

    return list;
  }, [entries, search, sortCol, sortDir, columns]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDelete = (id: string) => {
    deleteEntry(id);
    setDeleteId(null);
    toast({ title: t('sessionLibrary.deleted') });
  };

  const handleDuplicate = (id: string) => {
    duplicateEntry(id);
    toast({ title: t('sessionLibrary.duplicated') });
  };

  const deleteTarget = entries.find(e => e.id === deleteId);

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookmarkPlus className="h-6 w-6 text-primary" />
            {t('sessionLibrary.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('sessionLibrary.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddColOpen(true)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            {t('sessionLibrary.addColumn')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={`${t('sessionLibrary.title')}…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch('')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BookmarkPlus className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">{t('sessionLibrary.empty.title')}</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {t('sessionLibrary.empty.desc')}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('name')}
                >
                  {t('sessionLibrary.columns.name')}
                  <SortIcon col="name" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('method')}
                >
                  {t('sessionLibrary.columns.method')}
                  <SortIcon col="method" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('exercises')}
                >
                  {t('sessionLibrary.columns.exercises')}
                  <SortIcon col="exercises" />
                </TableHead>
                {/* Custom columns */}
                {columns.map(col => (
                  <TableHead
                    key={col.id}
                    className="cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort(col.id)}
                  >
                    <span className="flex items-center gap-1">
                      {col.name}
                      <SortIcon col={col.id} />
                      <button
                        className="ml-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                        onClick={e => {
                          e.stopPropagation();
                          removeColumn(col.id);
                        }}
                        title={t('common.remove')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </TableHead>
                ))}
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort('createdAt')}
                >
                  {t('sessionLibrary.columns.savedOn')}
                  <SortIcon col="createdAt" />
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5 + columns.length}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                displayed.map(entry => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-accent/50 group"
                    onClick={() => setDetailEntry(entry)}
                  >
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell>
                      {entry.method ? (
                        <Badge variant="secondary" className="text-xs font-normal">
                          {entry.method.split('::')[0]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t('sessionLibrary.exercises', {
                        count: entry.exercises.length,
                      })}
                    </TableCell>
                    {columns.map(col => (
                      <TableCell key={col.id} className="text-sm">
                        {entry.columnValues[col.id] ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.createdAt), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setDetailEntry(entry)}
                          >
                            {t('sessionLibrary.viewDetail')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(entry.id)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-2" />
                            {t('sessionLibrary.duplicate')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(entry.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            {t('sessionLibrary.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <AddColumnDialog
        open={addColOpen}
        onOpenChange={setAddColOpen}
        onAdd={addColumn}
      />

      <SessionDetailModal
        entry={detailEntry}
        columns={columns}
        open={!!detailEntry}
        onOpenChange={v => { if (!v) setDetailEntry(null); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('sessionLibrary.deleteDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name && (
                <>
                  &ldquo;<strong>{deleteTarget.name}</strong>&rdquo;{' '}
                </>
              )}
              {t('common.delete').toLowerCase()}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              {t('sessionLibrary.deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
