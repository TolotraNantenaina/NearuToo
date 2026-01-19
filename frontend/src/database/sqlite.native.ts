import * as SQLite from 'expo-sqlite';
import { Message, Chat } from '../stores/useChatStore';

let db: SQLite.SQLiteDatabase | null = null;
let dbVersion = 0;

const incrementVersion = () => {
  dbVersion++;
};

export const getDbVersion = () => dbVersion;

// Initialize database
export const initDatabase = async (): Promise<void> => {
  try {
    db = await SQLite.openDatabaseAsync('nearu.db');
    
    // Create tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        deviceId TEXT UNIQUE,
        username TEXT,
        lastSeen INTEGER
      );

      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        type TEXT,
        participants TEXT,
        participantNames TEXT,
        lastMessage TEXT,
        updatedAt INTEGER
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chatId TEXT,
        senderId TEXT,
        content TEXT,
        timestamp INTEGER,
        status TEXT,
        FOREIGN KEY (chatId) REFERENCES chats(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chatId ON messages(chatId);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_chats_updatedAt ON chats(updatedAt);
    `);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// ============================================================================
// MESSAGES
// ============================================================================

export const saveMessage = async (message: Message): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO messages (id, chatId, senderId, content, timestamp, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [message.id, message.chatId, message.senderId, message.content, message.timestamp, message.status]
    );
    incrementVersion();
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
};

export const getMessages = async (chatId: string, limit: number = 50): Promise<Message[]> => {
  if (!db) throw new Error('Database not initialized');

  try {
    const rows = await db.getAllAsync<Message>(
      `SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp DESC LIMIT ?`,
      [chatId, limit]
    );
    return rows.reverse();
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
};

export const updateMessageStatus = async (messageId: string, status: string): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  try {
    await db.runAsync(
      `UPDATE messages SET status = ? WHERE id = ?`,
      [status, messageId]
    );
    incrementVersion();
  } catch (error) {
    console.error('Error updating message status:', error);
  }
};

// ============================================================================
// CHATS
// ============================================================================

export const saveChat = async (chat: Chat): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO chats (id, type, participants, participantNames, lastMessage, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        chat.id,
        chat.type,
        JSON.stringify(chat.participants),
        JSON.stringify(chat.participantNames || {}),
        chat.lastMessage,
        chat.updatedAt
      ]
    );
    incrementVersion();
  } catch (error) {
    console.error('Error saving chat:', error);
    throw error;
  }
};

export const getChats = async (userId: string): Promise<Chat[]> => {
  if (!db) throw new Error('Database not initialized');

  try {
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM chats ORDER BY updatedAt DESC`
    );
    
    return rows
      .map(row => ({
        ...row,
        participants: JSON.parse(row.participants),
        participantNames: JSON.parse(row.participantNames || '{}')
      }))
      .filter(chat => chat.participants.includes(userId));
  } catch (error) {
    console.error('Error getting chats:', error);
    return [];
  }
};

export const updateChat = async (chatId: string, updates: Partial<Chat>): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  try {
    const sets: string[] = [];
    const values: any[] = [];

    if (updates.lastMessage !== undefined) {
      sets.push('lastMessage = ?');
      values.push(updates.lastMessage);
    }
    if (updates.updatedAt !== undefined) {
      sets.push('updatedAt = ?');
      values.push(updates.updatedAt);
    }

    if (sets.length > 0) {
      values.push(chatId);
      await db.runAsync(
        `UPDATE chats SET ${sets.join(', ')} WHERE id = ?`,
        values
      );
      incrementVersion();
    }
  } catch (error) {
    console.error('Error updating chat:', error);
  }
};

// ============================================================================
// UTILITY
// ============================================================================

export const createChatId = (userId1: string, userId2: string): string => {
  return [userId1, userId2].sort().join('-');
};

export const clearAllData = async (): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  try {
    await db.execAsync(`
      DELETE FROM messages;
      DELETE FROM chats;
      DELETE FROM users;
    `);
    incrementVersion();
  } catch (error) {
    console.error('Error clearing data:', error);
  }
};
