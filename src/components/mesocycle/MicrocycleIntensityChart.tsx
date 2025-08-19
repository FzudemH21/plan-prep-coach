import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import { ExtendedMesocycle, Intensity } from '@/features/planner/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

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

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: any;
  mesocycleIndex: number;
  weekIndex: number;
  onIntensityChange: (mesoIndex: number, weekIndex: number, intensity: Intensity) => void;
}

const CustomDot: React.FC<CustomDotProps> = ({ 
  cx, 
  cy, 
  payload, 
  mesocycleIndex, 
  weekIndex, 
  onIntensityChange 
}) => {
  const [open, setOpen] = React.useState(false);
  
  if (!payload || cx === undefined || cy === undefined) return null;
  
  const intensity = payload.intensity as Intensity;
  const color = intensityColors[intensity];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill={color}
          stroke="hsl(var(--border))"
          strokeWidth={2}
          className="cursor-pointer hover:r-8 transition-all"
          onClick={() => setOpen(true)}
        />
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">Week {weekIndex + 1} Intensity</p>
          <Select
            value={intensity}
            onValueChange={(value: Intensity) => {
              onIntensityChange(mesocycleIndex, weekIndex, value);
              setOpen(false);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intensityLevels.map((level) => (
                <SelectItem key={level} value={level}>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: intensityColors[level] }}
                    />
                    <span className="capitalize">{level.replace("-", " ")}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
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
  // Prepare chart data
  const chartData = React.useMemo(() => {
    const data: any[] = [];
    let globalWeekIndex = 0;
    
    mesocycles.forEach((meso, mesoIndex) => {
      for (let weekIndex = 0; weekIndex < meso.duration; weekIndex++) {
        const microcycle = meso.microcycles[weekIndex];
        const intensity = microcycle?.intensity || "moderate";
        
        data.push({
          week: `W${globalWeekIndex + 1}`,
          mesocycle: meso.name,
          mesocycleIndex: mesoIndex,
          weekIndex: weekIndex,
          intensity: intensity,
          intensityValue: getIntensityValue(intensity),
          [`meso_${mesoIndex}`]: getIntensityValue(intensity)
        });
        globalWeekIndex++;
      }
    });
    
    return data;
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
      <div className="bg-card border rounded-lg p-4">
        <h4 className="font-semibold mb-4">Microcycle Intensity Progression</h4>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="week" 
              stroke="hsl(var(--foreground))"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              domain={[0, intensityLevels.length - 1]}
              ticks={intensityLevels.map((_, index) => index)}
              tickFormatter={(value) => intensityLevels[value]?.replace("-", " ") || ""}
              stroke="hsl(var(--foreground))"
              tick={{ fontSize: 12 }}
              width={80}
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-medium">{label}</p>
                      <p className="text-sm text-muted-foreground">{data.mesocycle}</p>
                      <p className="text-sm">
                        Intensity: <span className="capitalize">{data.intensity.replace("-", " ")}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            
            {/* Create a line for each mesocycle */}
            {mesocycles.map((meso, mesoIndex) => {
              const mesoData = chartData.filter(d => d.mesocycleIndex === mesoIndex);
              const color = `hsl(${200 + mesoIndex * 50}, 70%, 50%)`;
              
              return (
                <Line
                  key={meso.id}
                  dataKey={`meso_${mesoIndex}`}
                  data={mesoData}
                  stroke={color}
                  strokeWidth={3}
                  connectNulls={false}
                  dot={(props) => (
                    <CustomDot
                      {...props}
                      mesocycleIndex={mesoIndex}
                      weekIndex={props.payload?.weekIndex || 0}
                      onIntensityChange={handleIntensityChange}
                    />
                  )}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
        
        {/* Mesocycle separators and labels */}
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-4">
            {mesocycles.map((meso, index) => {
              const color = `hsl(${200 + index * 50}, 70%, 50%)`;
              return (
                <div key={meso.id} className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium">{meso.name}</span>
                  <span className="text-xs text-muted-foreground">({meso.duration} weeks)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Click on any point in the chart to adjust the intensity for that specific week.
      </div>
    </div>
  );
};