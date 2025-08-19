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
  yAxisMax
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStartY, setDragStartY] = React.useState(0);
  const svgRef = React.useRef<SVGSVGElement>(null);
  
  if (!payload || cx === undefined || cy === undefined) return null;
  
  const intensity = payload.intensity as Intensity;
  const color = intensityColors[intensity];

  const getIntensityFromY = (yPos: number, svgRect: DOMRect): Intensity => {
    // Get chart area bounds relative to SVG
    const chartTop = 20; // margin.top
    const chartBottom = svgRect.height - 80; // height - margin.bottom
    const chartHeight = chartBottom - chartTop;
    
    // Convert mouse Y to chart-relative position
    const chartRelativeY = yPos - chartTop;
    const relativePosition = Math.max(0, Math.min(1, chartRelativeY / chartHeight));
    
    // Invert Y axis (top = high intensity, bottom = low intensity)
    const intensityIndex = Math.round((1 - relativePosition) * (intensityLevels.length - 1));
    return intensityLevels[Math.max(0, Math.min(intensityLevels.length - 1, intensityIndex))];
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartY(e.clientY);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      
      const rect = svgRef.current.getBoundingClientRect();
      const yPos = e.clientY - rect.top;
      const newIntensity = getIntensityFromY(yPos, rect);
      
      if (newIntensity !== intensity) {
        onIntensityChange(mesocycleIndex, weekIndex, newIntensity);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill={color}
        stroke="#000000"
        strokeWidth={2}
        className={`cursor-${isDragging ? 'grabbing' : 'grab'} transition-all ${isDragging ? 'scale-110' : 'hover:scale-110'}`}
        onMouseDown={handleMouseDown}
      />
      <svg ref={svgRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
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

  // Calculate mesocycle background areas
  const mesocycleAreas = React.useMemo(() => {
    const areas: Array<{ start: number, end: number, color: string, name: string }> = [];
    let currentWeek = 0;
    
    mesocycles.forEach((meso, index) => {
      areas.push({
        start: currentWeek,
        end: currentWeek + meso.duration,
        color: intensityColors[meso.intensity],
        name: meso.name
      });
      currentWeek += meso.duration;
    });
    
    return areas;
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
          <div style={{ minWidth: Math.max(600, chartData.length * 60) }}>
            <ResponsiveContainer width="100%" height={450}>
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 100, bottom: 100 }}>
            {/* Background areas for each mesocycle */}
            {mesocycleAreas.map((area, index) => (
              <ReferenceArea
                key={`area-${index}`}
                x1={area.start}
                x2={area.end}
                fill={area.color}
                fillOpacity={0.25}
                strokeOpacity={0}
              />
            ))}
            
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="globalWeek"
              stroke="hsl(var(--foreground))"
              tick={{ fontSize: 14 }}
              angle={-45}
              textAnchor="end"
              height={100}
              tickFormatter={(value) => {
                const dataPoint = chartData.find(d => d.globalWeek === value);
                return dataPoint ? `${dataPoint.mesocycle}\nW${dataPoint.weekIndex + 1}` : `W${value}`;
              }}
            />
            <YAxis 
              domain={[0, intensityLevels.length - 1]}
              ticks={intensityLevels.map((_, index) => index)}
              tickFormatter={(value) => intensityLevels[value]?.replace("-", " ") || ""}
              stroke="hsl(var(--foreground))"
              tick={{ fontSize: 14 }}
              width={100}
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
              stroke="#000000"
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