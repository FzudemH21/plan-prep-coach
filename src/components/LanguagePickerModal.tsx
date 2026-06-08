/**
 * LanguagePickerModal
 *
 * Shown on first open (no language preference saved yet).
 * Blocks the entire app until the user picks a language.
 * After selection the preference is stored via i18n (localStorage)
 * and the modal disappears — it never shows again.
 */

import { useState } from 'react';
import i18n, { SUPPORTED_LANGUAGES, isFirstOpen, LANGUAGE_STORAGE_KEY } from '@/i18n';

interface Props {
  onSelect: () => void;
}

export function LanguagePickerModal({ onSelect }: Props) {
  const [selecting, setSelecting] = useState<string | null>(null);

  const handleSelect = (code: string) => {
    setSelecting(code);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    i18n.changeLanguage(code).then(() => {
      onSelect();
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 px-6 text-center max-w-sm w-full">
        {/* Logo / app name */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Plan Prep Coach</h1>
          <p className="text-muted-foreground text-sm">Choose your language to get started.</p>
          <p className="text-muted-foreground text-sm">Wähle deine Sprache, um loszulegen.</p>
        </div>

        {/* Language cards */}
        <div className="flex gap-4 w-full">
          {SUPPORTED_LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              disabled={selecting !== null}
              className={[
                'flex-1 flex flex-col items-center gap-3 rounded-xl border-2 p-6',
                'transition-all duration-150',
                selecting === lang.code
                  ? 'border-primary bg-primary/5 scale-[0.98]'
                  : 'border-border hover:border-primary/50 hover:bg-muted/40 active:scale-[0.97]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              ].join(' ')}
            >
              <span className="text-4xl leading-none">{lang.flag}</span>
              <span className="text-sm font-medium">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
