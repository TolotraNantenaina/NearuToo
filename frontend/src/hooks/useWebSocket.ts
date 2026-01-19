import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useChatStore, Message, ConnectedClient } from '../stores/useChatStore';
import { saveMessage, saveChat, updateMessageStatus } from '../database/sqlite';

type MessageType = 'CONFIG' | 'HELLO' | 'HELLO_ACK' | 'MESSAGE' | 'CLIENTS' | 'REQUEST_CLIENTS' | 'SYSTEM';

interface WireEnvelope {
  type: MessageType;
  payload: any;
  timestamp: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketProps {
  url: string;
  autoConnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export const useWebSocket = ({
  url,
  autoConnect = false,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5
}: UseWebSocketProps) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef<WireEnvelope[]>([]);
  const isConnectedRef = useRef(false);
  
  const user = useAuthStore(state => state.user);
  const { addMessage, updateChat, setConnectedClients, addChat } = useChatStore();

  // Send message through WebSocket
  const sendMessage = useCallback((envelope: WireEnvelope) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(envelope));
    } else {
      console.warn('WebSocket not connected, queueing message');
      messageQueueRef.current.push(envelope);
    }
  }, []);

  // Send queued messages
  const sendQueuedMessages = useCallback(() => {
    while (messageQueueRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
      const envelope = messageQueueRef.current.shift();
      if (envelope) {
        wsRef.current.send(JSON.stringify(envelope));
      }
    }
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback(async (event: MessageEvent) => {
    try {
      const envelope: WireEnvelope = JSON.parse(event.data);
      console.log('Received:', envelope.type, envelope.payload);

      switch (envelope.type) {
        case 'CONFIG':
          // Server sent config, now send HELLO
          if (user) {
            const helloEnvelope: WireEnvelope = {
              type: 'HELLO',
              payload: {
                userId: user.id,
                deviceId: user.deviceId,
                username: user.username
              },
              timestamp: Date.now()
            };
            sendMessage(helloEnvelope);
          }
          break;

        case 'HELLO_ACK':
          console.log('Connected successfully:', envelope.payload);
          setStatus('connected');
          isConnectedRef.current = true;
          reconnectAttemptsRef.current = 0;
          
          // Update connected clients
          if (envelope.payload.connectedClients) {
            setConnectedClients(envelope.payload.connectedClients);
          }
          
          // Send queued messages
          sendQueuedMessages();
          break;

        case 'MESSAGE':
          // Received a chat message
          const message: Message = envelope.payload;
          
          // Add to store
          addMessage(message);
          
          // Save to database
          await saveMessage(message);
          
          // Update chat
          const chatUpdate = {
            lastMessage: message.content,
            updatedAt: message.timestamp
          };
          updateChat(message.chatId, chatUpdate);
          break;

        case 'CLIENTS':
          // Update list of connected clients
          if (envelope.payload.clients) {
            setConnectedClients(envelope.payload.clients);
          }
          break;

        case 'SYSTEM':
          console.log('System message:', envelope.payload);
          break;

        default:
          console.log('Unknown message type:', envelope.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }, [user, addMessage, updateChat, setConnectedClients, sendMessage, sendQueuedMessages]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!user) {
      console.warn('Cannot connect: user not initialized');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('Already connected or connecting');
      return;
    }

    console.log('Connecting to WebSocket:', url);
    setStatus('connecting');
    setError(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        // Status will be set to 'connected' after HELLO_ACK
      };

      ws.onmessage = handleMessage;

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error');
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        isConnectedRef.current = false;
        setStatus('disconnected');
        
        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          setError('Max reconnection attempts reached');
          setStatus('error');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setError('Failed to create connection');
      setStatus('error');
    }
  }, [url, user, handleMessage, reconnectDelay, maxReconnectAttempts]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    isConnectedRef.current = false;
    setStatus('disconnected');
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
  }, [maxReconnectAttempts]);

  // Send a chat message
  const sendChatMessage = useCallback(async (chatId: string, content: string, participants: string[]) => {
    if (!user) return;

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      chatId,
      senderId: user.id,
      content,
      timestamp: Date.now(),
      status: 'sending'
    };

    // Add to store immediately (optimistic update)
    addMessage(message);
    
    // Save to database
    await saveMessage(message);

    // Send through WebSocket
    const envelope: WireEnvelope = {
      type: 'MESSAGE',
      payload: {
        ...message,
        participants
      },
      timestamp: Date.now()
    };

    sendMessage(envelope);

    // Update status to delivered after sending
    setTimeout(async () => {
      const updatedMessage = { ...message, status: 'delivered' as const };
      addMessage(updatedMessage);
      await saveMessage(updatedMessage);
    }, 500);
  }, [user, addMessage, sendMessage]);

  // Request connected clients
  const requestClients = useCallback(() => {
    const envelope: WireEnvelope = {
      type: 'REQUEST_CLIENTS',
      payload: {},
      timestamp: Date.now()
    };
    sendMessage(envelope);
  }, [sendMessage]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, user]); // Don't include connect/disconnect to avoid infinite loops

  return {
    status,
    error,
    connect,
    disconnect,
    sendChatMessage,
    requestClients,
    isConnected: isConnectedRef.current
  };
};
