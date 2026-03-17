import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, AlertCircle } from 'lucide-react';
import { LibraryColumn, CustomLibrary } from '@/hooks/useCustomLibraries';

// ---------------------------------------------------------------------------
// CSV parsing (no external dependency)
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
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
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  // Normalise line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines
    .slice(1)
    .map(parseCSVLine)
    .filter(r => r.some(c => c.trim() !== ''));
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Auto-detect which CSV header is most likely the exercise name. */
function detectNameColumn(headers: string[]): string {
  const nameKeywords = ['name', 'exercise', 'exercise name', 'exercisename', 'übung', 'übungsname', 'titel', 'title'];
  const found = headers.find(h => nameKeywords.includes(h.toLowerCase().trim()));
  return found ?? headers[0] ?? '';
}

// ---------------------------------------------------------------------------
// Column mapping types
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
  /**
   * Called when the user confirms.
   * - newColumns must be added to library first.
   * - nameColumnLabel is the CSV header the user designated as the exercise name;
   *   the caller can use it to rename the first library column if it differs.
   */
  onImport: (
    rows: Array<Record<string, string>>,
    newColumns: Array<Omit<LibraryColumn, 'id'>>,
    nameColumnLabel: string,
  ) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkImportDialog({ isOpen, onClose, library, onImport }: BulkImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string>('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  /** Mappings for all columns EXCEPT the name column (handled by nameColumnHeader). */
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isExcelFile, setIsExcelFile] = useState(false);
  /** Which CSV header maps to the exercise name (first library column). */
  const [nameColumnHeader, setNameColumnHeader] = useState<string>('');

  // Derived
  const previewRows = fileRows.slice(0, 3);
  const importableRowCount = fileRows.length;

  // ------------------------------------------------------------------
  // Auto-map: match file header → existing library column (case-insensitive)
  // Excludes the name column header (handled separately).
  // ------------------------------------------------------------------
  const buildDefaultMappings = useCallback(
    (headers: string[], nameHeader: string): ColumnMapping[] => {
      return headers
        .filter(header => header !== nameHeader)
        .map(header => {
          const match = library.columns.slice(1).find(
            col => col.name.toLowerCase() === header.toLowerCase()
          );
          return {
            fileHeader: header,
            action: match ? match.id : 'create',
          };
        });
    },
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
    setMappings([]);
    setIsExcelFile(false);
    setNameColumnHeader('');

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
      if (typeof text !== 'string') {
        setParseError('Could not read file.');
        return;
      }
      try {
        const { headers, rows } = parseCSV(text);
        if (headers.length === 0) {
          setParseError('The file appears to be empty or has no headers.');
          return;
        }
        const detectedName = detectNameColumn(headers);
        setFileHeaders(headers);
        setFileRows(rows);
        setNameColumnHeader(detectedName);
        setMappings(buildDefaultMappings(headers, detectedName));
      } catch {
        setParseError('Failed to parse CSV. Please check the file format.');
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-selected after clearing
    e.target.value = '';
  };

  // ------------------------------------------------------------------
  // Name column change — rebuild non-name mappings
  // ------------------------------------------------------------------
  const handleNameColumnChange = (newNameHeader: string) => {
    setNameColumnHeader(newNameHeader);
    setMappings(buildDefaultMappings(fileHeaders, newNameHeader));
  };

  // ------------------------------------------------------------------
  // Mapping change
  // ------------------------------------------------------------------
  const setMappingAction = (index: number, action: MappingAction) => {
    setMappings(prev =>
      prev.map((m, i) => (i === index ? { ...m, action } : m))
    );
  };

  // ------------------------------------------------------------------
  // Confirm import
  // ------------------------------------------------------------------
  const handleConfirm = () => {
    const nameLibraryColumnId = library.columns[0]?.id ?? '';

    // 1. Build header→key map
    const newColumnDefs: Array<Omit<LibraryColumn, 'id'>> = [];
    const headerToKey: Record<string, string> = {};

    // Name column always maps to the first library column
    if (nameColumnHeader && nameLibraryColumnId) {
      headerToKey[nameColumnHeader] = nameLibraryColumnId;
    }

    // Additional columns from the mapping table
    mappings.forEach(mapping => {
      if (mapping.action === 'skip') return;
      if (mapping.action === 'create') {
        headerToKey[mapping.fileHeader] = `__new__${mapping.fileHeader}`;
        newColumnDefs.push({
          name: mapping.fileHeader,
          type: 'text',
          required: false,
        });
      } else {
        headerToKey[mapping.fileHeader] = mapping.action;
      }
    });

    // 2. Build rows, skip rows where name is empty
    const importedRows: Array<Record<string, string>> = fileRows
      .map(row => {
        const record: Record<string, string> = {};
        fileHeaders.forEach((header, i) => {
          const key = headerToKey[header];
          if (key) {
            record[key] = row[i] ?? '';
          }
        });
        return record;
      })
      .filter(record => (record[nameLibraryColumnId] ?? '').trim() !== '');

    onImport(importedRows, newColumnDefs, nameColumnHeader);
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
    setMappings([]);
    setIsExcelFile(false);
    setNameColumnHeader('');
    onClose();
  };

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const nonNameLibraryColumns = library.columns.slice(1);

  const renderMappingSelect = (mapping: ColumnMapping, index: number) => (
    <Select value={mapping.action} onValueChange={v => setMappingAction(index, v)}>
      <SelectTrigger className="w-52">
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

  const renderActionBadge = (action: MappingAction) => {
    if (action === 'skip') return <Badge variant="secondary">Skip</Badge>;
    if (action === 'create') return <Badge className="bg-green-100 text-green-800 border-green-200">New column</Badge>;
    const col = library.columns.find(c => c.id === action);
    return <Badge variant="outline">{col ? `→ ${col.name}` : action}</Badge>;
  };

  // How many rows will actually be imported (name column non-empty)
  const nameColIndex = fileHeaders.indexOf(nameColumnHeader);
  const validRowCount = nameColIndex >= 0
    ? fileRows.filter(row => (row[nameColIndex] ?? '').trim() !== '').length
    : 0;

  const canImport = nameColumnHeader !== '' && validRowCount > 0;

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>
            {fileName ? `Map Columns from "${fileName}"` : 'Import CSV'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-6 py-2">
          {/* File upload area */}
          {fileHeaders.length === 0 && !isExcelFile && (
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
          )}

          {/* Re-upload button when file already loaded */}
          {(fileHeaders.length > 0 || isExcelFile) && (
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Choose different file
              </Button>
              <span className="text-sm text-muted-foreground">{fileName}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
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

          {/* Unified column mapping table — all CSV columns in one list */}
          {fileHeaders.length > 0 && (
            <div>
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="text-sm font-semibold">
                  Column Mapping
                </h3>
                <span className="text-sm font-normal text-muted-foreground">
                  ({fileHeaders.length} column{fileHeaders.length !== 1 ? 's' : ''} found)
                </span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Name column</TableHead>
                      <TableHead>File Column</TableHead>
                      <TableHead>Map to Library Column</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <RadioGroup value={nameColumnHeader} onValueChange={handleNameColumnChange}>
                      {fileHeaders.map(header => {
                        const isName = header === nameColumnHeader;
                        const mappingIndex = mappings.findIndex(m => m.fileHeader === header);
                        const mapping = mappings[mappingIndex];
                        return (
                          <TableRow
                            key={header}
                            className={isName ? 'bg-primary/5' : undefined}
                          >
                            <TableCell className="text-center">
                              <RadioGroupItem value={header} id={`name-radio-${header}`} />
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm">{header}</span>
                              {isName && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  — required, empty rows skipped
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isName ? (
                                <span className="text-sm text-muted-foreground italic">
                                  Exercise name
                                </span>
                              ) : (
                                mapping !== undefined
                                  ? renderMappingSelect(mapping, mappingIndex)
                                  : null
                              )}
                            </TableCell>
                            <TableCell>
                              {isName ? (
                                <Badge className="bg-primary/10 text-primary border-primary/20">
                                  Name
                                </Badge>
                              ) : (
                                mapping !== undefined ? renderActionBadge(mapping.action) : null
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </RadioGroup>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Mark which column contains the exercise name — this is the only required field.
              </p>
            </div>
          )}

          {/* Data preview */}
          {previewRows.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">
                Data Preview
                <span className="font-normal text-muted-foreground ml-2">
                  (first {previewRows.length} of {importableRowCount} row{importableRowCount !== 1 ? 's' : ''})
                </span>
              </h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {fileHeaders.map(h => (
                        <TableHead
                          key={h}
                          className={`font-mono text-xs whitespace-nowrap${h === nameColumnHeader ? ' bg-primary/5 font-semibold' : ''}`}
                        >
                          {h}
                          {h === nameColumnHeader && (
                            <span className="ml-1 text-primary text-[10px]">(name)</span>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {fileHeaders.map((h, colIndex) => (
                          <TableCell
                            key={colIndex}
                            className={`text-sm max-w-[200px] truncate${h === nameColumnHeader ? ' font-medium' : ''}`}
                          >
                            {row[colIndex] ?? ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {fileHeaders.length > 0 && (
            <Button onClick={handleConfirm} disabled={!canImport}>
              Import {validRowCount} row{validRowCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
