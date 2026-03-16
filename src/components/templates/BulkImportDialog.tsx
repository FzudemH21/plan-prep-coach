import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  /** Called when the user confirms. newColumns must be added to library first. */
  onImport: (rows: Array<Record<string, string>>, newColumns: Array<Omit<LibraryColumn, 'id'>>) => void;
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
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isExcelFile, setIsExcelFile] = useState(false);

  // Derived
  const previewRows = fileRows.slice(0, 3);
  const importableRowCount = fileRows.length;

  // ------------------------------------------------------------------
  // Auto-map: match file header → existing library column (case-insensitive)
  // ------------------------------------------------------------------
  const buildDefaultMappings = useCallback(
    (headers: string[]): ColumnMapping[] => {
      return headers.map(header => {
        const match = library.columns.find(
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
        setFileHeaders(headers);
        setFileRows(rows);
        setMappings(buildDefaultMappings(headers));
      } catch {
        setParseError('Failed to parse CSV. Please check the file format.');
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-selected after clearing
    e.target.value = '';
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
    // 1. Collect new columns to create
    const newColumnDefs: Array<Omit<LibraryColumn, 'id'>> = [];
    // Map: file header → key to use inside each row record
    // For existing columns: use the real column id directly
    // For new columns: use "__new__<headerName>" so the parent can resolve by name
    const headerToKey: Record<string, string> = {};

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
        // Existing column id
        headerToKey[mapping.fileHeader] = mapping.action;
      }
    });

    // 2. Build rows using the resolved keys
    const importedRows: Array<Record<string, string>> = fileRows.map(row => {
      const record: Record<string, string> = {};
      fileHeaders.forEach((header, i) => {
        const key = headerToKey[header];
        if (key) {
          record[key] = row[i] ?? '';
        }
      });
      return record;
    });

    onImport(importedRows, newColumnDefs);
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
    onClose();
  };

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
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
        {library.columns.map(col => (
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

  const hasValidMappings = mappings.some(m => m.action !== 'skip');

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {fileName ? `Map Columns from "${fileName}"` : 'Import CSV'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
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

          {/* Column mapping table */}
          {fileHeaders.length > 0 && (
            <>
              <div>
                <h3 className="text-sm font-semibold mb-3">
                  Column Mapping
                  <span className="font-normal text-muted-foreground ml-2">
                    ({fileHeaders.length} column{fileHeaders.length !== 1 ? 's' : ''} found)
                  </span>
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Column</TableHead>
                        <TableHead>Map to Library Column</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappings.map((mapping, index) => (
                        <TableRow key={mapping.fileHeader}>
                          <TableCell className="font-mono text-sm">{mapping.fileHeader}</TableCell>
                          <TableCell>{renderMappingSelect(mapping, index)}</TableCell>
                          <TableCell>{renderActionBadge(mapping.action)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

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
                            <TableHead key={h} className="font-mono text-xs">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {fileHeaders.map((_, colIndex) => (
                              <TableCell key={colIndex} className="text-sm max-w-[200px] truncate">
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
            </>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {fileHeaders.length > 0 && (
            <Button onClick={handleConfirm} disabled={!hasValidMappings}>
              Import {importableRowCount} row{importableRowCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
