import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Message } from '@/utils/anthropicApi';

const LS_KEY = 'aiConversations';

interface ChatState {
  messages: Message[];
}

interface AIChatContextValue {
  chats: Record<string, ChatState>;
  setMessages: (chatId: string, messages: Message[]) => void;
  /** Re-hydrate the context from localStorage after a program is loaded. */
  initChatsFromLocalStorage: () => void;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

function readFromLS(): Record<string, ChatState> {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, Message[]>;
    return Object.fromEntries(
      Object.entries(parsed).map(([id, msgs]) => [id, { messages: msgs }])
    );
  } catch {
    return {};
  }
}

export function AIChatProvider({ children }: { children: ReactNode }) {
  // Seed from localStorage on mount so page refreshes restore conversations.
  const [chats, setChats] = useState<Record<string, ChatState>>(readFromLS);

  const setMessages = useCallback((chatId: string, messages: Message[]) => {
    setChats(prev => {
      const next = { ...prev, [chatId]: { messages } };
      // Mirror to localStorage so collectSessionData() picks it up on auto-save.
      try {
        const raw = Object.fromEntries(
          Object.entries(next).map(([id, s]) => [id, s.messages])
        );
        localStorage.setItem(LS_KEY, JSON.stringify(raw));
      } catch { /* storage full or unavailable — ignore */ }
      return next;
    });
  }, []);

  /** Called after loadProgramIntoSession() to restore a plan's conversations. */
  const initChatsFromLocalStorage = useCallback(() => {
    setChats(readFromLS());
  }, []);

  return (
    <AIChatContext.Provider value={{ chats, setMessages, initChatsFromLocalStorage }}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChatContext() {
  return useContext(AIChatContext);
}
