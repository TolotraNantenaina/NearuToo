import { create } from 'zustand';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'delivered' | 'failed';
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  participantNames?: { [userId: string]: string };
  lastMessage: string | null;
  updatedAt: number;
}

export interface ConnectedClient {
  id: string;
  deviceId: string;
  username: string;
  lastSeen: number;
}

interface ChatState {
  chats: Chat[];
  messages: { [chatId: string]: Message[] };
  connectedClients: ConnectedClient[];
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  setConnectedClients: (clients: ConnectedClient[]) => void;
  clearAll: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  messages: {},
  connectedClients: [],

  setChats: (chats: Chat[]) => set({ chats }),

  addChat: (chat: Chat) => set((state) => ({
    chats: [chat, ...state.chats.filter(c => c.id !== chat.id)]
  })),

  updateChat: (chatId: string, updates: Partial<Chat>) => set((state) => ({
    chats: state.chats.map(chat => 
      chat.id === chatId ? { ...chat, ...updates } : chat
    )
  })),

  setMessages: (chatId: string, messages: Message[]) => set((state) => ({
    messages: { ...state.messages, [chatId]: messages }
  })),

  addMessage: (message: Message) => set((state) => {
    const chatMessages = state.messages[message.chatId] || [];
    const existingIndex = chatMessages.findIndex(m => m.id === message.id);
    
    let updatedMessages;
    if (existingIndex >= 0) {
      // Update existing message (UPSERT)
      updatedMessages = [...chatMessages];
      updatedMessages[existingIndex] = message;
    } else {
      // Add new message
      updatedMessages = [...chatMessages, message];
    }
    
    return {
      messages: { ...state.messages, [message.chatId]: updatedMessages }
    };
  }),

  updateMessage: (messageId: string, updates: Partial<Message>) => set((state) => {
    const newMessages = { ...state.messages };
    
    Object.keys(newMessages).forEach(chatId => {
      newMessages[chatId] = newMessages[chatId].map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
    });
    
    return { messages: newMessages };
  }),

  setConnectedClients: (clients: ConnectedClient[]) => set({ connectedClients: clients }),

  clearAll: () => set({ chats: [], messages: {}, connectedClients: [] }),
}));
