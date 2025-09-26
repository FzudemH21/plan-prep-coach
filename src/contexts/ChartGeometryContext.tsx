import React, { createContext, useContext, useState, useLayoutEffect, useRef } from 'react';

interface ChartGeometry {
  plotTop: number;
  plotLeft: number;
  plotHeight: number;
  plotWidth: number;
  isReady: boolean;
}

const defaultGeometry: ChartGeometry = {
  plotTop: 0,
  plotLeft: 0,
  plotHeight: 330, // fallback
  plotWidth: 600, // fallback
  isReady: false,
};

const ChartGeometryContext = createContext<ChartGeometry>(defaultGeometry);

export const useChartGeometry = () => {
  return useContext(ChartGeometryContext);
};

interface ChartGeometryProviderProps {
  children: React.ReactNode;
  chartWrapperRef: React.RefObject<HTMLDivElement>;
  dependencies?: any[]; // Re-measure when these change
}

export const ChartGeometryProvider: React.FC<ChartGeometryProviderProps> = ({
  children,
  chartWrapperRef,
  dependencies = [],
}) => {
  const [geometry, setGeometry] = useState<ChartGeometry>(defaultGeometry);
  const rafRef = useRef<number>();

  const measureGeometry = () => {
    if (!chartWrapperRef.current) return;

    // Use requestAnimationFrame to ensure DOM is fully rendered
    rafRef.current = requestAnimationFrame(() => {
      const wrapper = chartWrapperRef.current;
      if (!wrapper) return;

      // Find the SVG surface
      const svgSurface = wrapper.querySelector('.recharts-surface') as SVGElement;
      if (!svgSurface) {
        // Not ready yet, try again in next frame
        rafRef.current = requestAnimationFrame(() => measureGeometry());
        return;
      }

      // Find horizontal gridlines to determine plot area
      const horizontalLines = wrapper.querySelectorAll('.recharts-cartesian-grid-horizontal line');
      
      if (horizontalLines.length > 0) {
        // Extract Y positions from gridlines
        const yPositions = Array.from(horizontalLines).map(line => {
          const y1 = parseFloat(line.getAttribute('y1') || '0');
          const y2 = parseFloat(line.getAttribute('y2') || '0');
          return Math.min(y1, y2); // Use the consistent Y position
        });

        const minY = Math.min(...yPositions);
        const maxY = Math.max(...yPositions);
        const plotHeight = maxY - minY;

        // Get SVG bounding rect for screen coordinates
        const svgRect = svgSurface.getBoundingClientRect();
        const plotTop = svgRect.top + minY;
        const plotLeft = svgRect.left;
        const plotWidth = svgRect.width;

        setGeometry({
          plotTop,
          plotLeft,
          plotHeight,
          plotWidth,
          isReady: true,
        });
      } else {
        // Fallback: use clipPath or margins
        const svgRect = svgSurface.getBoundingClientRect();
        const plotHeight = svgRect.height - 140; // Approximate: top(40) + bottom(100)
        const plotTop = svgRect.top + 40; // Approximate top margin
        
        setGeometry({
          plotTop,
          plotLeft: svgRect.left,
          plotHeight,
          plotWidth: svgRect.width,
          isReady: true,
        });
      }
    });
  };

  useLayoutEffect(() => {
    measureGeometry();

    // Re-measure on window resize
    const handleResize = () => {
      measureGeometry();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [chartWrapperRef, ...dependencies]);

  return (
    <ChartGeometryContext.Provider value={geometry}>
      {children}
    </ChartGeometryContext.Provider>
  );
};