import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function SportTagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');

  const addSport = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || value.includes(trimmed)) { setInputVal(''); return; }
    onChange([...value, trimmed]);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSport(inputVal); }
    if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap gap-1 border rounded-md px-2 py-1.5 min-h-9 bg-background focus-within:ring-1 focus-within:ring-ring">
      {value.map((sport) => (
        <Badge key={sport} variant="secondary" className="text-xs gap-1 pr-1">
          {sport}
          <button type="button" onClick={() => onChange(value.filter((s) => s !== sport))} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addSport(inputVal)}
        placeholder={value.length === 0 ? 'Type sport and press Enter…' : ''}
        className="flex-1 min-w-20 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
