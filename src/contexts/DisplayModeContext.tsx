import { createContext, useContext, useState, ReactNode } from 'react';
import { DisplayMode } from '@/types/training';

interface DisplayModeContextType {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
}

const DisplayModeContext = createContext<DisplayModeContextType | undefined>(undefined);

export const useDisplayMode = () => {
  const context = useContext(DisplayModeContext);
  if (context === undefined) {
    throw new Error('useDisplayMode must be used within a DisplayModeProvider');
  }
  return context;
};

interface DisplayModeProviderProps {
  children: ReactNode;
}

export const DisplayModeProvider = ({ children }: DisplayModeProviderProps) => {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("step-by-step");

  return (
    <DisplayModeContext.Provider value={{ displayMode, setDisplayMode }}>
      {children}
    </DisplayModeContext.Provider>
  );
};