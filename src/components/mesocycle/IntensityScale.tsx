import React from 'react';
import { BORG_SCALE, getBorgBg, getBorgLabel, BorgLevel } from '@/utils/intensityScale';

// Band height per level (100% / 11 levels ≈ 9.09%)
const BAND_HEIGHT = 100 / 11;

const IntensityScale: React.FC = () => {
  const chartHeight = 200; // Match IntensityColumn height

  // Grid lines at each band boundary (0%, 9.09%, 18.18%, …, 100%)
  const gridPercentages = BORG_SCALE.map((_, i) => i * BAND_HEIGHT).concat([100]);

  return (
    <div className="w-[150px] flex flex-col items-end bg-background">
      {/* Header spacer — aligns with day headers */}
      <div className="text-xs p-1 mb-2 h-20 flex items-end justify-end">
        <span className="font-medium text-muted-foreground">Intensity</span>
      </div>

      {/* Scale container */}
      <div className="relative w-24" style={{ height: `${chartHeight}px` }}>
        {/* Grid lines */}
        {gridPercentages.map((pct) => (
          <div
            key={pct}
            className="absolute w-full border-t border-border/20"
            style={{
              bottom: `${pct}%`,
              borderStyle: pct === 0 || pct === 100 ? 'solid' : 'dashed',
            }}
          />
        ))}

        {/* Intensity level bands — rendered bottom-up (level 0 at bottom) */}
        {BORG_SCALE.map((entry, i) => {
          const bottom = i * BAND_HEIGHT;
          return (
            <div
              key={entry.level}
              className="absolute right-0 flex items-center"
              style={{ bottom: `${bottom}%`, height: `${BAND_HEIGHT}%` }}
            >
              <span className="text-xs font-medium text-right pr-2 w-28 text-foreground whitespace-nowrap">
                {entry.level} – {getBorgLabel(entry.level as BorgLevel)}
              </span>
              <div
                className="w-6 h-full flex items-center justify-center"
                style={{ backgroundColor: getBorgBg(entry.level as BorgLevel) }}
              />
            </div>
          );
        })}
      </div>

      {/* Footer spacer — aligns with intensity labels */}
      <div className="text-xs mt-2 h-4" />
    </div>
  );
};

export default IntensityScale;
