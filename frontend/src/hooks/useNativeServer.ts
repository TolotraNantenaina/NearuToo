import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NativeWebSocketServer, ConnectedClient } from '../native/NativeWebSocketServer';
import { useWebSocket } from './useWebSocket';
import { useAuthStore } from '../stores/useAuthStore';

export type ServerMode = 'none' | 'server' | 'client';

interface UseNativeServerProps {
  port?: number;
  autoConnectToSelf?: boolean;
}

interface UseNativeServerReturn {
  // Server state
  mode: ServerMode;
  isServerRunning: boolean;
  connectedClients: ConnectedClient[];
  localIp: string | null;
  
  // Server actions
  startServer: () => Promise<boolean>;
  stopServer: () => Promise<void>;
  
  // Client actions
  connectToServer: (serverIp: string, port?: number) => void;
  disconnectFromServer: () => void;
  
  // WebSocket status (for client mode)
  clientStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  clientError: string | null;
}

/**
 * Hook to manage native WebSocket server and client connections
 */
export const useNativeServer = ({
  port = 45454,
  autoConnectToSelf = true,
}: UseNativeServerProps = {}): UseNativeServerReturn => {
  const user = useAuthStore(state => state.user);
  const [mode, setMode] = useState<ServerMode>('none');
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([]);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const updateClientsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket client (used when connecting to a server)
  const {
    status: clientStatus,
    error: clientError,
    connect: wsConnect,
    disconnect: wsDisconnect,
  } = useWebSocket({
    url: '', // Will be set dynamically
    autoConnect: false,
  });

  // Get local IP address
  const fetchLocalIp = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      if (state.details && 'ipAddress' in state.details) {
        const ip = (state.details as any).ipAddress;
        setLocalIp(ip);
        return ip;
      }
    } catch (error) {
      console.error('Failed to get local IP:', error);
    }
    return null;
  }, []);

  // Update connected clients periodically
  const updateConnectedClients = useCallback(async () => {
    if (isServerRunning) {
      try {
        const clients = await NativeWebSocketServer.getConnectedClients();
        setConnectedClients(clients);
      } catch (error) {
        console.error('Failed to get connected clients:', error);
      }
    }
  }, [isServerRunning]);

  // Start server
  const startServer = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      console.warn('WebSocket server not available on web');
      return false;
    }

    if (isServerRunning) {
      console.log('Server already running');
      return true;
    }

    try {
      console.log('[useNativeServer] Starting server on port', port);
      
      // Start native server
      const result = await NativeWebSocketServer.startServer(port);
      
      if (result.success) {
        setIsServerRunning(true);
        setMode('server');
        
        // Get local IP
        const ip = await fetchLocalIp();
        
        // Connect to self if enabled
        if (autoConnectToSelf && user) {
          console.log('[useNativeServer] Connecting to self at 127.0.0.1');
          setTimeout(() => {
            wsConnect(`ws://127.0.0.1:${port}/ws`);
          }, 1000);
        }
        
        // Start polling for connected clients
        updateClientsIntervalRef.current = setInterval(updateConnectedClients, 2000);
        
        console.log('[useNativeServer] Server started successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[useNativeServer] Failed to start server:', error);
      return false;
    }
  }, [isServerRunning, port, fetchLocalIp, autoConnectToSelf, user, wsConnect, updateConnectedClients]);

  // Stop server
  const stopServer = useCallback(async () => {
    try {
      console.log('[useNativeServer] Stopping server');
      
      // Clear interval
      if (updateClientsIntervalRef.current) {
        clearInterval(updateClientsIntervalRef.current);
        updateClientsIntervalRef.current = null;
      }
      
      // Disconnect client connection
      wsDisconnect();
      
      // Stop native server
      await NativeWebSocketServer.stopServer();
      
      setIsServerRunning(false);
      setMode('none');
      setConnectedClients([]);
      
      console.log('[useNativeServer] Server stopped');
    } catch (error) {
      console.error('[useNativeServer] Failed to stop server:', error);
    }
  }, [wsDisconnect]);

  // Connect to a server (as client)
  const connectToServer = useCallback((serverIp: string, serverPort: number = port) => {
    console.log('[useNativeServer] Connecting to server:', serverIp, serverPort);
    setMode('client');
    wsConnect(`ws://${serverIp}:${serverPort}/ws`);
  }, [port, wsConnect]);

  // Disconnect from server
  const disconnectFromServer = useCallback(() => {
    console.log('[useNativeServer] Disconnecting from server');
    wsDisconnect();
    setMode('none');
  }, [wsDisconnect]);

  // Setup event listeners
  useEffect(() => {
    if (!NativeWebSocketServer.isAvailable()) {
      return;
    }

    const unsubscribeConnected = NativeWebSocketServer.addEventListener(
      'onClientConnected',
      (event) => {
        console.log('[useNativeServer] Client connected:', event);
        updateConnectedClients();
      }
    );

    const unsubscribeDisconnected = NativeWebSocketServer.addEventListener(
      'onClientDisconnected',
      (event) => {
        console.log('[useNativeServer] Client disconnected:', event);
        updateConnectedClients();
      }
    );

    const unsubscribeMessage = NativeWebSocketServer.addEventListener(
      'onMessageReceived',
      (event) => {
        console.log('[useNativeServer] Message received:', event);
      }
    );

    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeMessage();
    };
  }, [updateConnectedClients]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateClientsIntervalRef.current) {
        clearInterval(updateClientsIntervalRef.current);
      }
    };
  }, []);

  return {
    mode,
    isServerRunning,
    connectedClients,
    localIp,
    startServer,
    stopServer,
    connectToServer,
    disconnectFromServer,
    clientStatus,
    clientError,
  };
};
