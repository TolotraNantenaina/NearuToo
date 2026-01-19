import { Message, Chat } from '../stores/useChatStore';

// Web uses in-memory storage
let memoryStore: {
  users: any[];
  chats: Chat[];
  messages: Message[];
} = {
  users: [],
  chats: [],
  messages: []
};

let dbVersion = 0;

const incrementVersion = () => {
  dbVersion++;
};

export const getDbVersion = () => dbVersion;

export const initDatabase = async (): Promise<void> => {
  console.log('Running on web, using in-memory storage');
};

export const saveMessage = async (message: Message): Promise<void> => {
  const existingIndex = memoryStore.messages.findIndex(m => m.id === message.id);
  if (existingIndex >= 0) {
    memoryStore.messages[existingIndex] = message;
  } else {
    memoryStore.messages.push(message);
  }
  incrementVersion();
};

export const getMessages = async (chatId: string, limit: number = 50): Promise<Message[]> => {
  return memoryStore.messages
    .filter(m => m.chatId === chatId)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);
};

export const updateMessageStatus = async (messageId: string, status: string): Promise<void> => {
  const message = memoryStore.messages.find(m => m.id === messageId);
  if (message) {
    message.status = status as any;
    incrementVersion();
  }
};

export const saveChat = async (chat: Chat): Promise<void> => {
  const existingIndex = memoryStore.chats.findIndex(c => c.id === chat.id);
  if (existingIndex >= 0) {
    memoryStore.chats[existingIndex] = chat;
  } else {
    memoryStore.chats.push(chat);
  }
  incrementVersion();
};

export const getChats = async (userId: string): Promise<Chat[]> => {
  return memoryStore.chats
    .filter(c => c.participants.includes(userId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

export const updateChat = async (chatId: string, updates: Partial<Chat>): Promise<void> => {
  const chat = memoryStore.chats.find(c => c.id === chatId);
  if (chat) {
    Object.assign(chat, updates);
    incrementVersion();
  }
};

export const createChatId = (userId1: string, userId2: string): string => {
  return [userId1, userId2].sort().join('-');
};

export const clearAllData = async (): Promise<void> => {
  memoryStore = { users: [], chats: [], messages: [] };
  incrementVersion();
};
