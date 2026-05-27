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
import {
  BORG_LEVELS,
  getBorgBg,
  getBorgLabel,
  getBorgLabelFull,
  getBorgValue,
  getBorgFromValue,
  migrateLegacyIntensity,
} from '@/utils/intensityScale';

// Y-axis maps 0–10 directly to numeric values
const getIntensityValue = (intensity: Intensity): number => getBorgValue(intensity);
const getIntensityFromValue = (value: number): Intensity => getBorgFromValue(value) as Intensity;

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
  xDomain,
}) => {
  const pixelX =
    margin.left +
    ((centerX - xDomain[0]) / (xDomain[1] - xDomain[0])) *
      (chartWidth - margin.left - margin.right);
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

const CustomMicrocycleTick: React.FC<CustomWeekTickProps> = ({ x = 0, y = 0, payload, data }) => {
  const value = payload?.value ?? 0;
  const point = data.find((d) => d.globalMicrocycle === value);
  if (!point) return null;

  const isLast = point.isLastMicrocycleOfMeso;
  const microcycleLabel = point.microcycleName || `Mic${point.microcycleIndex + 1}`;

  return (
    <g>
      <line
        x1={x}
        y1={y - (isLast ? 8 : 0)}
        x2={x}
        y2={y + 6}
        stroke="hsl(var(--foreground))"
        strokeWidth={isLast ? 2 : 1}
      />
      <text x={x} y={y + 18} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={14}>
        {microcycleLabel}
      </text>
    </g>
  );
};

interface DraggableDotProps {
  cx?: number;
  cy?: number;
  payload?: any;
  mesocycleIndex: number;
  microcycleIndex: number;
  onIntensityChange: (mesoIndex: number, microIndex: number, intensity: Intensity) => void;
  chartHeight: number;
  yAxisMin: number;
  yAxisMax: number;
}

const DraggableDot: React.FC<DraggableDotProps> = ({
  cx,
  cy,
  payload,
  mesocycleIndex,
  microcycleIndex,
  onIntensityChange,
  chartHeight,
  yAxisMin,
  yAxisMax,
}) => {
  const [dragging, setDragging] = React.useState(false);
  const [dragPosition, setDragPosition] = React.useState<{ x: number; y: number } | null>(null);
  const [currentIntensity, setCurrentIntensity] = React.useState<Intensity>(
    () => migrateLegacyIntensity(payload?.intensity) as Intensity
  );
  const startYRef = React.useRef<number>(0);
  const startCyRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (payload?.intensity) {
      setCurrentIntensity(migrateLegacyIntensity(payload.intensity) as Intensity);
    }
  }, [payload?.intensity]);

  if (!payload || cx === undefined || cy === undefined) return null;

  const color = getBorgBg(currentIntensity);
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
    const newY = Math.max(0, Math.min(chartHeight, startCyRef.current + dy));

    // Borg CR10: 11 levels (0–10), Y axis spans 0–10
    const stepHeight = chartHeight / 10; // 10 steps for 11 levels
    const normalizedPosition = (chartHeight - newY) / stepHeight;
    const borgValue = Math.max(0, Math.min(10, Math.round(normalizedPosition)));
    const newIntensity = getIntensityFromValue(borgValue);

    setDragPosition({ x: cx, y: newY });
    setCurrentIntensity(newIntensity);
  };

  const onPointerUp = (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault();
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(false);
    setDragPosition(null);

    if (currentIntensity !== payload.intensity) {
      onIntensityChange(mesocycleIndex, microcycleIndex, currentIntensity);
    }
  };

  return (
    <g>
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
      <circle
        cx={displayCx}
        cy={displayCy}
        r={8}
        fill={color}
        stroke="hsl(var(--foreground))"
        strokeWidth={dragging ? 3 : 2}
        style={{
          cursor: dragging ? 'grabbing' : 'ns-resize',
          touchAction: 'none',
          transition: dragging ? 'none' : 'all 0.2s ease',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      {dragging && (
        <text
          x={displayCx}
          y={Math.max(15, displayCy - 20)}
          textAnchor="middle"
          fill="hsl(var(--foreground))"
          fontSize={12}
          fontWeight="bold"
          className="pointer-events-none"
        >
          {getBorgLabelFull(currentIntensity)}
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
  onMesocyclesChange,
}) => {
  const chartData = React.useMemo(() => {
    const data: any[] = [];
    let globalMicrocycleIndex = 0;

    mesocycles.forEach((meso, mesoIndex) => {
      meso.microcycles?.forEach((microcycle, microIndex) => {
        const migratedIntensity = migrateLegacyIntensity(microcycle.intensity);
        data.push({
          microcycle: `${meso.name}\n${microcycle.name}`,
          globalMicrocycle: globalMicrocycleIndex + 1,
          mesocycle: meso.name,
          mesocycleIndex: mesoIndex,
          microcycleIndex: microIndex,
          microcycleName: microcycle.name,
          intensity: migratedIntensity,
          intensityValue: getIntensityValue(migratedIntensity),
          mesocycleIntensity: migrateLegacyIntensity(meso.intensity),
          duration: microcycle.duration,
          isFirstMicrocycleOfMeso: microIndex === 0,
          isLastMicrocycleOfMeso: microIndex === (meso.microcycles?.length || 1) - 1,
        });
        globalMicrocycleIndex++;
      });
    });

    return data;
  }, [mesocycles]);

  const { mesocycleAreas, mesocycleCenters } = React.useMemo(() => {
    const areas: Array<{ x1: number; x2: number; color: string; name: string }> = [];
    const centers: Array<{ name: string; centerX: number }> = [];
    let currentStart = 1;

    mesocycles.forEach((meso) => {
      const first = currentStart;
      const last = currentStart + (meso.microcycles?.length || 0) - 1;
      const centerX = (first + last) / 2;

      areas.push({
        x1: first - 0.5,
        x2: last + 0.5,
        color: getBorgBg(migrateLegacyIntensity(meso.intensity)),
        name: meso.name,
      });

      centers.push({ name: meso.name, centerX });
      currentStart = last + 1;
    });

    return { mesocycleAreas: areas, mesocycleCenters: centers };
  }, [mesocycles]);

  const handleIntensityChange = (mesoIndex: number, microIndex: number, intensity: Intensity) => {
    const updatedMesocycles = [...mesocycles];

    if (!updatedMesocycles[mesoIndex].microcycles) {
      updatedMesocycles[mesoIndex].microcycles = [];
    }

    while (updatedMesocycles[mesoIndex].microcycles.length <= microIndex) {
      updatedMesocycles[mesoIndex].microcycles.push({
        id: `micro-${mesoIndex + 1}-${updatedMesocycles[mesoIndex].microcycles.length + 1}`,
        name: `Microcycle ${updatedMesocycles[mesoIndex].microcycles.length + 1}`,
        duration: 7,
        intensity: '5',
      });
    }

    updatedMesocycles[mesoIndex].microcycles[microIndex].intensity = intensity;
    onMesocyclesChange(updatedMesocycles);
  };

  return (
    <div className="space-y-6">
      {/* Intensity Legend */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <h4 className="font-semibold mb-3">Intensity Scale (Borg CR10)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {BORG_LEVELS.map((level) => (
            <div key={level} className="flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: getBorgBg(level) }}
              />
              <span className="text-sm">{getBorgLabelFull(level)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border rounded-lg p-4 relative">
        <h4 className="font-semibold mb-4 text-lg">Microcycle Intensity Progression</h4>
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(800, chartData.length * 100), paddingRight: '50px' }}>
            <ResponsiveContainer width="100%" height={470}>
              <LineChart data={chartData} margin={{ top: 40, right: 50, left: 100, bottom: 100 }}>
                {mesocycleCenters.map((center, index) => (
                  <MesocycleLabel
                    key={`mesocycle-label-${center.name}-${index}`}
                    mesocycleName={center.name}
                    centerX={center.centerX}
                    chartWidth={800}
                    chartHeight={470}
                    margin={{ left: 100, right: 50, bottom: 100 }}
                    xDomain={[1, chartData.length]}
                  />
                ))}
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
                  dataKey="globalMicrocycle"
                  domain={[1, chartData.length]}
                  ticks={chartData.map((d) => d.globalMicrocycle)}
                  interval={0}
                  stroke="hsl(var(--foreground))"
                  height={80}
                  tickLine={false}
                  tick={(props) => <CustomMicrocycleTick {...props} data={chartData} />}
                />

                <YAxis
                  domain={[0, 10]}
                  ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  tickFormatter={(value) => getBorgLabel(String(value) as any)}
                  stroke="hsl(var(--foreground))"
                  tick={{ fontSize: 13 }}
                  width={120}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.microcycleName}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.mesocycle} - {data.duration} days
                          </p>
                          <p className="text-sm">
                            Intensity:{' '}
                            <span className="font-medium">
                              {getBorgLabelFull(data.intensity)}
                            </span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Line
                  dataKey="intensityValue"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  connectNulls={false}
                  dot={(props) => (
                    <DraggableDot
                      {...props}
                      mesocycleIndex={props.payload?.mesocycleIndex || 0}
                      microcycleIndex={props.payload?.microcycleIndex || 0}
                      onIntensityChange={handleIntensityChange}
                      chartHeight={330}
                      yAxisMin={0}
                      yAxisMax={10}
                    />
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mesocycle legend */}
        <div className="mt-4 space-y-2">
          <h5 className="font-medium text-sm">Mesocycle Intensities:</h5>
          <div className="flex flex-wrap gap-4">
            {mesocycles.map((meso) => {
              const migratedIntensity = migrateLegacyIntensity(meso.intensity);
              return (
                <div key={meso.id} className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getBorgBg(migratedIntensity) }}
                  />
                  <span className="text-sm font-medium">{meso.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({getBorgLabelFull(migratedIntensity)} - {meso.microcycles?.length || 0} microcycles)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Drag any dot up or down to adjust the intensity for that specific microcycle.
      </div>
    </div>
  );
};
