import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { WebSocketServer } = NativeModules;

if (!WebSocketServer) {
  console.warn('WebSocketServer native module not found. Make sure you are running on a device with a built app.');
}

const eventEmitter = WebSocketServer ? new NativeEventEmitter(WebSocketServer) : null;

export interface ConnectedClient {
  userId: string;
  username: string;
  deviceId: string;
  connectedAt: number;
}

export interface ServerStartResult {
  success: boolean;
  port: number;
  message: string;
}

export interface BroadcastResult {
  success: boolean;
  sentCount: number;
}

export type ServerEventType =
  | 'onClientConnected'
  | 'onClientDisconnected'
  | 'onMessageReceived'
  | 'onServerStarted'
  | 'onServerStopped'
  | 'onServerError';

export interface ServerEvents {
  onClientConnected: { userId: string; username: string; deviceId: string };
  onClientDisconnected: { userId: string };
  onMessageReceived: { message: string; fromUserId: string };
  onServerStarted: { port: number };
  onServerStopped: null;
  onServerError: { error: string };
}

/**
 * Native WebSocket Server for P2P communication
 * Only works on iOS/Android (not web)
 */
export class NativeWebSocketServer {
  private static eventListeners: Map<ServerEventType, Set<Function>> = new Map();

  /**
   * Check if native server is available
   */
  static isAvailable(): boolean {
    return Platform.OS !== 'web' && !!WebSocketServer;
  }

  /**
   * Start the WebSocket server
   * @param port Port number (default: 45454)
   */
  static async startServer(port: number = 45454): Promise<ServerStartResult> {
    if (!this.isAvailable()) {
      throw new Error('WebSocket server is only available on native platforms');
    }

    try {
      const result = await WebSocketServer.startServer(port);
      console.log('[NativeWebSocketServer] Server started:', result);
      return result;
    } catch (error) {
      console.error('[NativeWebSocketServer] Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  static async stopServer(): Promise<{ success: boolean; message: string }> {
    if (!this.isAvailable()) {
      throw new Error('WebSocket server is only available on native platforms');
    }

    try {
      const result = await WebSocketServer.stopServer();
      console.log('[NativeWebSocketServer] Server stopped:', result);
      return result;
    } catch (error) {
      console.error('[NativeWebSocketServer] Failed to stop server:', error);
      throw error;
    }
  }

  /**
   * Check if server is currently running
   */
  static async isServerRunning(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      return await WebSocketServer.isServerRunning();
    } catch (error) {
      console.error('[NativeWebSocketServer] Failed to check server status:', error);
      return false;
    }
  }

  /**
   * Get list of connected clients
   */
  static async getConnectedClients(): Promise<ConnectedClient[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      return await WebSocketServer.getConnectedClients();
    } catch (error) {
      console.error('[NativeWebSocketServer] Failed to get connected clients:', error);
      return [];
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param message Message to broadcast (JSON string)
   * @param excludeUserId Optional user ID to exclude from broadcast
   */
  static async broadcastMessage(
    message: string,
    excludeUserId?: string
  ): Promise<BroadcastResult> {
    if (!this.isAvailable()) {
      throw new Error('WebSocket server is only available on native platforms');
    }

    try {
      return await WebSocketServer.broadcastMessage(message, excludeUserId || null);
    } catch (error) {
      console.error('[NativeWebSocketServer] Failed to broadcast message:', error);
      throw error;
    }
  }

  /**
   * Add event listener
   */
  static addEventListener<T extends ServerEventType>(
    eventType: T,
    listener: (event: ServerEvents[T]) => void
  ): () => void {
    if (!eventEmitter) {
      console.warn('Event emitter not available');
      return () => {};
    }

    // Store listener
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);

    // Subscribe to native event
    const subscription = eventEmitter.addListener(eventType, listener);

    // Return unsubscribe function
    return () => {
      subscription.remove();
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.eventListeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Remove all event listeners
   */
  static removeAllListeners() {
    if (eventEmitter) {
      this.eventListeners.forEach((_, eventType) => {
        eventEmitter.removeAllListeners(eventType);
      });
    }
    this.eventListeners.clear();
  }
}

export default NativeWebSocketServer;
