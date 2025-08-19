import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { ExtendedMesocycle, Intensity } from '@/features/planner/types';

const intensityLevels: Intensity[] = [
  "off",
  "deload", 
  "easy",
  "easy-moderate",
  "moderate",
  "moderate-hard",
  "hard",
  "extremely-hard"
];

const intensityColors: Record<Intensity, string> = {
  "off": "hsl(var(--intensity-off))",
  "deload": "hsl(var(--intensity-deload))",
  "easy": "hsl(var(--intensity-easy))",
  "easy-moderate": "hsl(var(--intensity-easy-moderate))",
  "moderate": "hsl(var(--intensity-moderate))",
  "moderate-hard": "hsl(var(--intensity-moderate-hard))",
  "hard": "hsl(var(--intensity-hard))",
  "extremely-hard": "hsl(var(--intensity-extremely-hard))"
};

const getIntensityValue = (intensity: Intensity): number => {
  return intensityLevels.indexOf(intensity);
};

const getIntensityFromValue = (value: number): Intensity => {
  return intensityLevels[value] || "moderate";
};

interface CustomWeekTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
  data: any[];
}

interface MesocycleLabelProps {
  mesocycleName: string;
  centerX: number;
  chartWidth: number;
  chartHeight: number;
  margin: { left: number; right: number; bottom: number };
  xDomain: [number, number];
}

const MesocycleLabel: React.FC<MesocycleLabelProps> = ({ 
  mesocycleName, 
  centerX, 
  chartWidth, 
  chartHeight, 
  margin, 
  xDomain 
}) => {
  // Convert data coordinate to pixel coordinate
  const pixelX = margin.left + ((centerX - xDomain[0]) / (xDomain[1] - xDomain[0])) * (chartWidth - margin.left - margin.right);
  const pixelY = chartHeight - margin.bottom + 35;
  
  return (
    <text 
      x={pixelX} 
      y={pixelY} 
      textAnchor="middle" 
      fill="hsl(var(--muted-foreground))" 
      fontSize={12}
    >
      {mesocycleName}
    </text>
  );
};

const CustomWeekTick: React.FC<CustomWeekTickProps> = ({ x = 0, y = 0, payload, data }) => {
  const value = payload?.value ?? 0;
  const point = data.find((d) => d.globalWeek === value);
  if (!point) return null;

  const isLast = point.isLastWeekOfMeso;
  const weekLabel = `W${point.weekIndex + 1}`;

  return (
    <g>
      {/* custom tick line (taller on last week of meso) */}
      <line
        x1={x}
        y1={y - (isLast ? 8 : 0)}
        x2={x}
        y2={y + 6}
        stroke="hsl(var(--foreground))"
        strokeWidth={isLast ? 2 : 1}
      />
      {/* week label */}
      <text x={x} y={y + 18} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={14}>
        {weekLabel}
      </text>
    </g>
  );
};

interface DraggableDotProps {
  cx?: number;
  cy?: number;
  payload?: any;
  mesocycleIndex: number;
  weekIndex: number;
  onIntensityChange: (mesoIndex: number, weekIndex: number, intensity: Intensity) => void;
  chartHeight: number;
  yAxisMin: number;
  yAxisMax: number;
}

const DraggableDot: React.FC<DraggableDotProps> = ({
  cx,
  cy,
  payload,
  mesocycleIndex,
  weekIndex,
  onIntensityChange,
  chartHeight,
  yAxisMin,
  yAxisMax,
}) => {
  const [dragging, setDragging] = React.useState(false);
  const [dragPosition, setDragPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [currentIntensity, setCurrentIntensity] = React.useState<Intensity>(() => payload?.intensity as Intensity || "moderate");
  const startYRef = React.useRef<number>(0);
  const startCyRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (payload?.intensity) {
      setCurrentIntensity(payload.intensity as Intensity);
    }
  }, [payload?.intensity]);

  if (!payload || cx === undefined || cy === undefined) return null;

  const color = intensityColors[currentIntensity];
  const displayCx = dragPosition?.x ?? cx;
  const displayCy = dragPosition?.y ?? cy;

  const onPointerDown = (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    startYRef.current = e.clientY;
    startCyRef.current = cy;
    setDragPosition({ x: cx, y: cy });
  };

  const onPointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragging) return;
    e.preventDefault();
    
    const dy = e.clientY - startYRef.current;
    const newY = Math.max(20, Math.min(chartHeight - 20, startCyRef.current + dy));
    
    // Calculate which intensity level this Y position corresponds to
    const stepHeight = (chartHeight - 40) / (intensityLevels.length - 1); // 20px margin top/bottom
    const relativeY = newY - 20; // Remove top margin
    const normalizedPosition = (chartHeight - 40 - relativeY) / stepHeight; // Invert Y axis
    
    // Use direct mapping without premature snapping
    const intensityIndex = Math.max(0, Math.min(intensityLevels.length - 1, Math.round(normalizedPosition)));
    const newIntensity = getIntensityFromValue(intensityIndex);
    
    setDragPosition({ x: cx, y: newY });
    setCurrentIntensity(newIntensity);
    // Don't update the actual data during drag to prevent re-renders that break dragging
  };

  const onPointerUp = (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(false);
    setDragPosition(null);
    
    // Only trigger the actual change on release
    if (currentIntensity !== payload.intensity) {
      onIntensityChange(mesocycleIndex, weekIndex, currentIntensity);
    }
  };

  return (
    <g>
      {/* Glow effect when dragging */}
      {dragging && (
        <circle
          cx={displayCx}
          cy={displayCy}
          r={12}
          fill={color}
          fillOpacity={0.3}
          stroke="none"
        />
      )}
      {/* Main dot */}
      <circle
        cx={displayCx}
        cy={displayCy}
        r={8}
        fill={color}
        stroke={"hsl(var(--foreground))"}
        strokeWidth={dragging ? 3 : 2}
        style={{ 
          cursor: dragging ? 'grabbing' : 'ns-resize', 
          touchAction: 'none',
          transition: dragging ? 'none' : 'all 0.2s ease'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      {/* Intensity label when dragging */}
      {dragging && (
        <text
          x={displayCx}
          y={displayCy - 20}
          textAnchor="middle"
          fill="hsl(var(--foreground))"
          fontSize={12}
          fontWeight="bold"
          className="pointer-events-none"
        >
          {currentIntensity.replace("-", " ")}
        </text>
      )}
    </g>
  );
};

interface MicrocycleIntensityChartProps {
  mesocycles: ExtendedMesocycle[];
  onMesocyclesChange: (mesocycles: ExtendedMesocycle[]) => void;
}

export const MicrocycleIntensityChart: React.FC<MicrocycleIntensityChartProps> = ({
  mesocycles,
  onMesocyclesChange
}) => {
  // Prepare chart data with mesocycle boundaries
  const chartData = React.useMemo(() => {
    const data: any[] = [];
    let globalWeekIndex = 0;
    
    mesocycles.forEach((meso, mesoIndex) => {
      for (let weekIndex = 0; weekIndex < meso.duration; weekIndex++) {
        const microcycle = meso.microcycles[weekIndex];
        const intensity = microcycle?.intensity || "moderate";
        
        data.push({
          week: `${meso.name}\nW${weekIndex + 1}`,
          globalWeek: globalWeekIndex + 1,
          mesocycle: meso.name,
          mesocycleIndex: mesoIndex,
          weekIndex: weekIndex,
          intensity: intensity,
          intensityValue: getIntensityValue(intensity),
          mesocycleIntensity: meso.intensity,
          isFirstWeekOfMeso: weekIndex === 0,
          isLastWeekOfMeso: weekIndex === meso.duration - 1
        });
        globalWeekIndex++;
      }
    });
    
    return data;
  }, [mesocycles]);

  // Calculate mesocycle background areas and center positions for labels
  const { mesocycleAreas, mesocycleCenters } = React.useMemo(() => {
    const areas: Array<{ x1: number; x2: number; color: string; name: string }> = [];
    const centers: Array<{ name: string; centerX: number }> = [];
    let currentStart = 1; // globalWeek is 1-based

    mesocycles.forEach((meso) => {
      const first = currentStart;
      const last = currentStart + meso.duration - 1;
      const centerX = (first + last) / 2; // Calculate center position
      
      areas.push({
        x1: first - 0.5, // start boundary
        x2: last + 0.5,  // end boundary
        color: intensityColors[meso.intensity],
        name: meso.name,
      });
      
      centers.push({
        name: meso.name,
        centerX: centerX
      });
      
      currentStart = last + 1;
    });

    return { mesocycleAreas: areas, mesocycleCenters: centers };
  }, [mesocycles]);

  const handleIntensityChange = (mesoIndex: number, weekIndex: number, intensity: Intensity) => {
    const updatedMesocycles = [...mesocycles];
    
    // Ensure microcycles array exists and has the right length
    if (!updatedMesocycles[mesoIndex].microcycles) {
      updatedMesocycles[mesoIndex].microcycles = [];
    }
    
    // Ensure the specific microcycle exists
    while (updatedMesocycles[mesoIndex].microcycles.length <= weekIndex) {
      updatedMesocycles[mesoIndex].microcycles.push({ intensity: "moderate" });
    }
    
    updatedMesocycles[mesoIndex].microcycles[weekIndex].intensity = intensity;
    onMesocyclesChange(updatedMesocycles);
  };

  return (
    <div className="space-y-6">
      {/* Intensity Legend */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3">Intensity Scale</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {intensityLevels.map((level) => (
            <div key={level} className="flex items-center space-x-2">
              <div 
                className="w-4 h-4 rounded-full border border-border" 
                style={{ backgroundColor: intensityColors[level] }}
              />
              <span className="text-sm capitalize">{level.replace("-", " ")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border rounded-lg p-4 relative">
        <h4 className="font-semibold mb-4 text-lg">Microcycle Intensity Progression</h4>
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(800, chartData.length * 100), paddingRight: '50px' }}>
            <ResponsiveContainer width="100%" height={450}>
              <LineChart data={chartData} margin={{ top: 20, right: 50, left: 100, bottom: 100 }}>
            {/* Mesocycle labels positioned correctly */}
            {mesocycleCenters.map((center, index) => (
              <MesocycleLabel
                key={`mesocycle-label-${center.name}-${index}`}
                mesocycleName={center.name}
                centerX={center.centerX}
                chartWidth={800}
                chartHeight={450}
                margin={{ left: 100, right: 50, bottom: 100 }}
                xDomain={[1, chartData.length]}
              />
            ))}
            {/* Background areas for each mesocycle */}
            {mesocycleAreas.map((area, index) => (
              <ReferenceArea
                key={`mesocycle-bg-${area.name}-${index}`}
                x1={area.x1}
                x2={area.x2}
                fill={area.color}
                fillOpacity={0.5}
                strokeOpacity={0}
              />
            ))}
            
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              type="number"
              dataKey="globalWeek"
              domain={[1, chartData.length]}
              ticks={chartData.map(d => d.globalWeek)}
              interval={0}
              stroke="hsl(var(--foreground))"
              height={80}
              tickLine={false}
              tick={(props) => <CustomWeekTick {...props} data={chartData} />}
            />
            
            <YAxis 
              domain={[0, intensityLevels.length - 1]}
              ticks={intensityLevels.map((_, index) => index)}
              tickFormatter={(value) => intensityLevels[value]?.replace("-", " ") || ""}
              stroke="hsl(var(--foreground))"
              tick={{ fontSize: 16 }}
              width={120}
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-medium">Week {data.globalWeek}</p>
                      <p className="text-sm text-muted-foreground">{data.mesocycle} - Week {data.weekIndex + 1}</p>
                      <p className="text-sm">
                        Intensity: <span className="capitalize">{data.intensity.replace("-", " ")}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            
            {/* Single line connecting all points */}
            <Line
              dataKey="intensityValue"
              stroke={"hsl(var(--foreground))"}
              strokeWidth={2}
              connectNulls={false}
              dot={(props) => (
                <DraggableDot
                  {...props}
                  mesocycleIndex={props.payload?.mesocycleIndex || 0}
                  weekIndex={props.payload?.weekIndex || 0}
                  onIntensityChange={handleIntensityChange}
                  chartHeight={400}
                  yAxisMin={0}
                  yAxisMax={intensityLevels.length - 1}
                />
              )}
            />
          </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Mesocycle legend with their intensities */}
        <div className="mt-4 space-y-2">
          <h5 className="font-medium text-sm">Mesocycle Intensities:</h5>
          <div className="flex flex-wrap gap-4">
            {mesocycles.map((meso, index) => (
              <div key={meso.id} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: intensityColors[meso.intensity] }}
                />
                <span className="text-sm font-medium">{meso.name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  ({meso.intensity.replace("-", " ")} - {meso.duration} weeks)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Drag any dot up or down to adjust the intensity for that specific week.
      </div>
    </div>
  );
};