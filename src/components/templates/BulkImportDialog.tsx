import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Upload, AlertCircle, ChevronLeft, Video, FileText, Download } from 'lucide-react';
import { LibraryColumn, CustomLibrary } from '@/hooks/useCustomLibraries';
import { toCSV, downloadCSV } from '@/utils/csvUtils';

// ---------------------------------------------------------------------------
// CSV parsing (no external dependency)
// ---------------------------------------------------------------------------

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === sep && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function detectSeparator(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCSV(text: string, sep: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0], sep);
  const rows = lines
    .slice(1)
    .map(l => parseCSVLine(l, sep))
    .filter(r => r.some(c => c.trim() !== ''));
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectNameColumn(headers: string[]): string {
  const nameKeywords = ['name', 'exercise', 'exercise name', 'exercisename', 'übung', 'übungsname', 'titel', 'title'];
  const found = headers.find(h => nameKeywords.includes(h.toLowerCase().trim()));
  return found ?? headers[0] ?? '';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MappingAction = 'skip' | 'create' | string; // string = existing column id

interface ColumnMapping {
  fileHeader: string;
  action: MappingAction;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BulkImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  library: CustomLibrary;
  onImport: (
    rows: Array<Record<string, string>>,
    newColumns: Array<Omit<LibraryColumn, 'id'>>,
    nameColumnLabel: string,
    existingColumnRoleUpdates: Array<{ id: string; role: 'video' | 'description' }>,
  ) => void;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Columns', 'Name', 'Special Fields', 'Mapping'] as const;

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center justify-center gap-1 px-6 py-3 border-b bg-muted/30">
      {([1, 2, 3, 4] as const).map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center gap-0.5">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-colors ${
                s === step
                  ? 'bg-primary text-primary-foreground'
                  : s < step
                  ? 'bg-primary/25 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </div>
            <span
              className={`text-[10px] whitespace-nowrap ${
                s === step ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}
            >
              {STEP_LABELS[i]}
            </span>
          </div>
          {s < 4 && (
            <div
              className={`h-px w-8 mb-3.5 transition-colors ${s < step ? 'bg-primary/40' : 'bg-muted'}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkImportDialog({ isOpen, onClose, library, onImport }: BulkImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  const [isExcelFile, setIsExcelFile] = useState(false);
  const [rawFileText, setRawFileText] = useState('');
  const [separator, setSeparator] = useState(',');

  // Step state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeHeaders, setActiveHeaders] = useState<Set<string>>(new Set());
  const [nameColumnHeader, setNameColumnHeader] = useState('');
  const [videoColumnHeader, setVideoColumnHeader] = useState('');
  const [descriptionColumnHeader, setDescriptionColumnHeader] = useState('');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);

  // Ordered list of active headers (preserves CSV order)
  const activeHeadersOrdered = fileHeaders.filter(h => activeHeaders.has(h));

  // Non-name library columns available as mapping targets
  const nonNameLibraryColumns = library.columns.slice(1);

  // Build default mappings for active non-name headers
  const buildMappings = useCallback(
    (headers: string[], nameHeader: string): ColumnMapping[] =>
      headers
        .filter(h => h !== nameHeader)
        .map(h => {
          const match = library.columns
            .slice(1)
            .find(col => col.name.toLowerCase() === h.toLowerCase());
          return { fileHeader: h, action: match ? match.id : 'create' };
        }),
    [library.columns]
  );

  // ------------------------------------------------------------------
  // File selection
  // ------------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError('');
    setFileHeaders([]);
    setFileRows([]);
    setActiveHeaders(new Set());
    setNameColumnHeader('');
    setMappings([]);
    setIsExcelFile(false);
    setStep(1);

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'xlsx' || ext === 'xls') {
      setIsExcelFile(true);
      return;
    }

    if (ext !== 'csv') {
      setParseError('Unsupported file type. Please upload a .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result;
      if (typeof text !== 'string') { setParseError('Could not read file.'); return; }
      try {
        const sep = detectSeparator(text);
        setSeparator(sep);
        setRawFileText(text);
        const { headers, rows } = parseCSV(text, sep);
        if (headers.length === 0) {
          setParseError('The file appears to be empty or has no headers.');
          return;
        }
        setFileHeaders(headers);
        setFileRows(rows);
        setActiveHeaders(new Set(headers));
        setNameColumnHeader(detectNameColumn(headers));
        setStep(1);
      } catch {
        setParseError('Failed to parse CSV. Please check the file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ------------------------------------------------------------------
  // Step navigation
  // ------------------------------------------------------------------
  const goToStep2 = () => {
    // If detected name column was deactivated, re-detect from active set
    if (!activeHeaders.has(nameColumnHeader)) {
      setNameColumnHeader(detectNameColumn(activeHeadersOrdered));
    }
    setStep(2);
  };

  const goToStep3 = () => {
    setStep(3);
  };

  const goToStep4 = () => {
    const specialHeaders = new Set([videoColumnHeader, descriptionColumnHeader].filter(Boolean));
    const headersForMapping = activeHeadersOrdered.filter(h => !specialHeaders.has(h));
    setMappings(buildMappings(headersForMapping, nameColumnHeader));
    setStep(4);
  };

  // ------------------------------------------------------------------
  // Mapping change
  // ------------------------------------------------------------------
  const setMappingAction = (index: number, action: MappingAction) => {
    setMappings(prev => prev.map((m, i) => (i === index ? { ...m, action } : m)));
  };

  // ------------------------------------------------------------------
  // Confirm import
  // ------------------------------------------------------------------
  const handleConfirm = () => {
    const nameLibraryColumnId = library.columns[0]?.id ?? '';
    const newColumnDefs: Array<Omit<LibraryColumn, 'id'>> = [];
    const existingColumnRoleUpdates: Array<{ id: string; role: 'video' | 'description' }> = [];
    const headerToKey: Record<string, string> = {};

    if (nameColumnHeader && nameLibraryColumnId) {
      headerToKey[nameColumnHeader] = nameLibraryColumnId;
    }

    // Special columns are not in mappings — handle them directly here.
    if (descriptionColumnHeader) {
      headerToKey[descriptionColumnHeader] = 'description';
    }
    if (videoColumnHeader) {
      headerToKey[videoColumnHeader] = 'videoUrl';
    }

    mappings.forEach(mapping => {
      if (mapping.action === 'skip') return;
      if (mapping.action === 'create') {
        headerToKey[mapping.fileHeader] = `__new__${mapping.fileHeader}`;
        newColumnDefs.push({ name: mapping.fileHeader, type: 'text', required: false });
      } else {
        headerToKey[mapping.fileHeader] = mapping.action;
      }
    });

    const importedRows: Array<Record<string, string>> = fileRows
      .map(row => {
        const record: Record<string, string> = {};
        fileHeaders.forEach((header, i) => {
          const key = headerToKey[header];
          if (key) record[key] = row[i] ?? '';
        });
        return record;
      })
      .filter(record => (record[nameLibraryColumnId] ?? '').trim() !== '');

    onImport(importedRows, newColumnDefs, nameColumnHeader, existingColumnRoleUpdates);
    handleClose();
  };

  // ------------------------------------------------------------------
  // Close / reset
  // ------------------------------------------------------------------
  const handleClose = () => {
    setFileName('');
    setParseError('');
    setFileHeaders([]);
    setFileRows([]);
    setActiveHeaders(new Set());
    setNameColumnHeader('');
    setVideoColumnHeader('');
    setDescriptionColumnHeader('');
    setMappings([]);
    setIsExcelFile(false);
    setRawFileText('');
    setSeparator(',');
    setStep(1);
    onClose();
  };

  // ------------------------------------------------------------------
  // Derived counts
  // ------------------------------------------------------------------
  const nameColIndex = fileHeaders.indexOf(nameColumnHeader);
  const validRowCount =
    nameColIndex >= 0
      ? fileRows.filter(row => (row[nameColIndex] ?? '').trim() !== '').length
      : 0;

  const canProceedStep1 = activeHeaders.size > 0;
  const canProceedStep2 = nameColumnHeader !== '' && activeHeaders.has(nameColumnHeader);

  const hasFile = fileHeaders.length > 0;

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const renderMappingAction = (mapping: ColumnMapping, index: number) => (
    <Select value={mapping.action} onValueChange={v => setMappingAction(index, v)}>
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="skip">
          <span className="text-muted-foreground italic">Skip this column</span>
        </SelectItem>
        <SelectItem value="create">
          <span className="text-green-600 font-medium">Create as new column</span>
        </SelectItem>
        {nonNameLibraryColumns.map(col => (
          <SelectItem key={col.id} value={col.id}>
            {col.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // ------------------------------------------------------------------
  // Step content
  // ------------------------------------------------------------------

  const handleSeparatorChange = (sep: string) => {
    setSeparator(sep);
    if (!rawFileText) return;
    try {
      const { headers, rows } = parseCSV(rawFileText, sep);
      setFileHeaders(headers);
      setFileRows(rows);
      setActiveHeaders(new Set(headers));
      setNameColumnHeader(detectNameColumn(headers));
      setParseError('');
    } catch {
      setParseError('Could not parse file with this separator.');
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium shrink-0">Column separator:</span>
        <div className="flex gap-2">
          {[{ label: 'Comma (,)', value: ',' }, { label: 'Semicolon (;)', value: ';' }, { label: 'Tab', value: '\t' }].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSeparatorChange(opt.value)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${separator === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-foreground/40'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold mb-1">Which columns do you want to import?</p>
        <p className="text-xs text-muted-foreground mb-4">
          Uncheck any columns you want to skip.
        </p>
        <div className="space-y-2">
          {fileHeaders.map(header => (
            <div key={header} className="flex items-center gap-3 py-1.5 px-3 rounded-md hover:bg-muted/40">
              <Checkbox
                id={`col-${header}`}
                checked={activeHeaders.has(header)}
                onCheckedChange={checked => {
                  setActiveHeaders(prev => {
                    const next = new Set(prev);
                    if (checked) next.add(header); else next.delete(header);
                    return next;
                  });
                }}
              />
              <Label htmlFor={`col-${header}`} className="font-mono text-sm cursor-pointer">
                {header}
              </Label>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {activeHeaders.size} of {fileHeaders.length} column{fileHeaders.length !== 1 ? 's' : ''} selected
      </p>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold mb-1">Which column contains the exercise name?</p>
        <p className="text-xs text-muted-foreground mb-4">
          This is the only required field. Rows with an empty name will be skipped.
        </p>
        <RadioGroup value={nameColumnHeader} onValueChange={setNameColumnHeader} className="space-y-2">
          {activeHeadersOrdered.map(header => (
            <div key={header} className="flex items-center gap-3 py-1.5 px-3 rounded-md hover:bg-muted/40">
              <RadioGroupItem value={header} id={`name-${header}`} />
              <Label htmlFor={`name-${header}`} className="font-mono text-sm cursor-pointer">
                {header}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <p className="text-xs text-muted-foreground">
        {validRowCount} row{validRowCount !== 1 ? 's' : ''} will be imported
        {fileRows.length - validRowCount > 0 &&
          ` (${fileRows.length - validRowCount} skipped — empty name)`}
      </p>
    </div>
  );

  const renderStep3 = () => {
    const nonNameHeaders = activeHeadersOrdered.filter(h => h !== nameColumnHeader);
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold mb-1">Do any columns contain special fields?</p>
          <p className="text-xs text-muted-foreground mb-4">
            Both are optional. Marked columns get special display treatment in the exercise detail view — video columns show an embedded player, description columns appear prominently.
          </p>
        </div>

        {nonNameHeaders.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No additional columns available — only the name column is active.
          </p>
        ) : (
          <>
            {/* Video column */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Video className="h-4 w-4 text-muted-foreground" />
                Video URL column
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select
                value={videoColumnHeader || '__none__'}
                onValueChange={v => setVideoColumnHeader(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {nonNameHeaders
                    .filter(h => h !== descriptionColumnHeader)
                    .map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description column */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Description column
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select
                value={descriptionColumnHeader || '__none__'}
                onValueChange={v => setDescriptionColumnHeader(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {nonNameHeaders
                    .filter(h => h !== videoColumnHeader)
                    .map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold mb-1">How should each column be imported?</p>
        <p className="text-xs text-muted-foreground mb-4">
          Map each column to an existing library column, or create a new one.
        </p>
        {mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No additional columns to map — only the name column is active.
          </p>
        ) : (
          <div className="space-y-2">
            {mappings.map((mapping, index) => (
              <div key={mapping.fileHeader} className="flex items-center gap-3">
                <span className="flex-1 font-mono text-sm truncate" title={mapping.fileHeader}>
                  {mapping.fileHeader}
                </span>
                {renderMappingAction(mapping, index)}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {validRowCount} row{validRowCount !== 1 ? 's' : ''} will be imported
      </p>
    </div>
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            {!hasFile ? 'Import CSV' : `Import from "${fileName}"`}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator — only when file is loaded */}
        {hasFile && <StepIndicator step={step} />}

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {/* File upload area */}
          {!hasFile && !isExcelFile && (
            <div className="space-y-3">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Click to upload a CSV file</p>
                <p className="text-xs text-muted-foreground">Excel files (.xlsx, .xls) require conversion to CSV first</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {library.columns.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => {
                    const headers = [...library.columns.map(c => c.name), 'Video URL', 'Description'];
                    const example = [
                      ...library.columns.map(c =>
                        c.type === 'select' && c.options?.length ? c.options[0] : 'Example value'
                      ),
                      'https://youtube.com/watch?v=...',
                      'Optional exercise description (shown in detail view)'
                    ];
                    downloadCSV(`${library.name}-sample.csv`, toCSV(headers, [example]));
                  }}
                >
                  <Download className="h-4 w-4" />
                  Download sample CSV
                </Button>
              )}
            </div>
          )}

          {/* Excel not supported */}
          {isExcelFile && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Excel import is not supported</p>
                <p className="text-amber-700 mt-1">
                  Please export your Excel file as CSV (File → Save As → CSV) and upload the CSV version.
                </p>
              </div>
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{parseError}</p>
            </div>
          )}

          {/* Step content */}
          {hasFile && step === 1 && renderStep1()}
          {hasFile && step === 2 && renderStep2()}
          {hasFile && step === 3 && renderStep3()}
          {hasFile && step === 4 && renderStep4()}

          {/* Hidden file input for re-upload */}
          {hasFile && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {hasFile && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                Change file
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasFile && step > 1 && (
              <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            {hasFile && step === 1 && (
              <Button onClick={goToStep2} disabled={!canProceedStep1}>
                Next
              </Button>
            )}
            {hasFile && step === 2 && (
              <Button onClick={goToStep3} disabled={!canProceedStep2}>
                Next
              </Button>
            )}
            {hasFile && step === 3 && (
              <Button onClick={goToStep4}>
                Next
              </Button>
            )}
            {hasFile && step === 4 && (
              <Button onClick={handleConfirm} disabled={validRowCount === 0}>
                Import {validRowCount} row{validRowCount !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
