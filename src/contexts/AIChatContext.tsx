import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Message } from '@/utils/anthropicApi';

interface ChatState {
  messages: Message[];
}

interface AIChatContextValue {
  chats: Record<string, ChatState>;
  setMessages: (chatId: string, messages: Message[]) => void;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

export function AIChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Record<string, ChatState>>({});

  const setMessages = useCallback((chatId: string, messages: Message[]) => {
    setChats(prev => ({ ...prev, [chatId]: { messages } }));
  }, []);

  return (
    <AIChatContext.Provider value={{ chats, setMessages }}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChatContext() {
  return useContext(AIChatContext);
}
