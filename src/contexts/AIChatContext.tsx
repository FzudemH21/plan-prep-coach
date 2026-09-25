import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Message } from '@/utils/anthropicApi';

const LS_KEY = 'aiConversations';

/**
 * One AI conversation per training program, shared by every wizard step (Macro, Meso, Micro),
 * so context carries over when the coach moves between steps. Saved with the program.
 * All other chats (Parameter Database, Toolbox, libraries, athlete calendar) are global.
 */
export const WIZARD_CHAT_ID = 'training-program';

/** Before 2026-09-25 each wizard step had its own chat, keyed by its step title (in wizard order). */
const LEGACY_WIZARD_STEP_CHAT_IDS = [
  'Plan Setup & Goals', 'Sub-Goals & Testing', 'Training Methods',
  'Mesocycle Setup', 'Daily Training Intensity Planning', 'Mesocycle Characterization',
  'Method Periodization', 'Exercise Selection',
  'Method Distribution to Training Days', 'Exercise Distribution', 'Training Calendar',
];

/** True for chats that belong to a training program (saved/restored/cleared with it). */
export const isProgramChatId = (id: string): boolean =>
  id === WIZARD_CHAT_ID || LEGACY_WIZARD_STEP_CHAT_IDS.includes(id);

/**
 * Migration: fold old per-step wizard chats into the single program conversation, in wizard
 * order, each block prefixed with its step title. Consecutive same-role messages are joined
 * so the result still alternates user/assistant.
 */
export function mergeLegacyWizardChats(raw: Record<string, Message[]>): Record<string, Message[]> {
  const legacyIds = LEGACY_WIZARD_STEP_CHAT_IDS.filter(id => raw[id]?.length);
  if (legacyIds.length === 0) return raw;

  const merged: Message[] = [];
  const push = (m: Message) => {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) merged[merged.length - 1] = { ...last, content: `${last.content}\n\n${m.content}` };
    else merged.push(m);
  };
  legacyIds.forEach(id => raw[id].forEach((m, i) => push(i === 0 ? { ...m, content: `[${id}]\n${m.content}` } : m)));
  (raw[WIZARD_CHAT_ID] ?? []).forEach(push);

  const next = Object.fromEntries(Object.entries(raw).filter(([id]) => !LEGACY_WIZARD_STEP_CHAT_IDS.includes(id)));
  next[WIZARD_CHAT_ID] = merged;
  return next;
}

interface ChatState {
  messages: Message[];
}

interface AIChatContextValue {
  chats: Record<string, ChatState>;
  setMessages: (chatId: string, messages: Message[]) => void;
  /** Re-hydrate the context from localStorage after a program is loaded. */
  initChatsFromLocalStorage: () => void;
  /**
   * Drop the program conversation (in memory and localStorage), keeping global chats.
   * Must be called when a new program is started — this provider lives above the router,
   * so its state otherwise survives clearSession() and the next message would write the
   * previous program's chat back to localStorage, where auto-save stores it in the new program.
   */
  resetChats: () => void;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

function writeToLS(chats: Record<string, ChatState>) {
  try {
    const raw = Object.fromEntries(Object.entries(chats).map(([id, s]) => [id, s.messages]));
    localStorage.setItem(LS_KEY, JSON.stringify(raw));
  } catch { /* storage full or unavailable — ignore */ }
}

function readFromLS(): Record<string, ChatState> {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, Message[]>;
    const migrated = mergeLegacyWizardChats(parsed);
    const chats = Object.fromEntries(
      Object.entries(migrated).map(([id, msgs]) => [id, { messages: msgs }])
    );
    if (migrated !== parsed) writeToLS(chats);
    return chats;
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
      writeToLS(next);
      return next;
    });
  }, []);

  /** Called after loadProgramIntoSession() to restore a plan's conversations. */
  const initChatsFromLocalStorage = useCallback(() => {
    setChats(readFromLS());
  }, []);

  const resetChats = useCallback(() => {
    setChats(prev => {
      const next = Object.fromEntries(Object.entries(prev).filter(([id]) => !isProgramChatId(id)));
      writeToLS(next);
      return next;
    });
  }, []);

  return (
    <AIChatContext.Provider value={{ chats, setMessages, initChatsFromLocalStorage, resetChats }}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChatContext() {
  return useContext(AIChatContext);
}
