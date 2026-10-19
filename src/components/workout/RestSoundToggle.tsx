import { Volume2, VolumeX } from 'lucide-react';

/** Speaker button on the rest screen — switches the rest timer sound on / off (saved per device) */
export function RestSoundToggle({ on, onToggle, labelOn, labelOff }: {
  on: boolean;
  onToggle: () => void;
  /** aria-label while the sound is on (the action: switch off) */
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute top-2 left-2 w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground [@media(hover:hover)]:hover:bg-muted active:bg-muted/80 transition-colors"
      aria-label={on ? labelOn : labelOff}
      aria-pressed={on}
    >
      {on ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
    </button>
  );
}
