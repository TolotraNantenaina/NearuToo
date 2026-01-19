import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore, ConnectedClient } from '../../src/stores/useChatStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useWebSocket } from '../../src/hooks/useWebSocket';
import { createChatId, saveChat } from '../../src/database/sqlite';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function DiscoverScreen() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { connectedClients, setConnectedClients, addChat } = useChatStore();
  const [manualIp, setManualIp] = useState('');
  
  // Convert http(s) to ws(s) for WebSocket
  const wsUrl = BACKEND_URL?.replace(/^http/, 'ws') + '/api/ws' || 'ws://localhost:8001/api/ws';
  
  const { status, connect, disconnect, requestClients } = useWebSocket({
    url: wsUrl,
    autoConnect: false,
  });

  useEffect(() => {
    // Auto-connect on mount
    if (user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user]);

  const handleConnect = () => {
    connect();
  };

  const handleRefresh = () => {
    requestClients();
  };

  const handleStartChat = async (client: ConnectedClient) => {
    if (!user) return;

    try {
      // Create chat ID
      const chatId = createChatId(user.id, client.id);

      // Create chat object
      const newChat = {
        id: chatId,
        type: 'direct' as const,
        participants: [user.id, client.id],
        participantNames: {
          [client.id]: client.username,
        },
        lastMessage: null,
        updatedAt: Date.now(),
      };

      // Save to database
      await saveChat(newChat);
      
      // Add to store
      addChat(newChat);

      // Navigate to chat
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat');
    }
  };

  const handleManualConnect = () => {
    if (!manualIp.trim()) {
      Alert.alert('Error', 'Please enter an IP address');
      return;
    }
    
    // TODO: Implement manual IP connection
    Alert.alert('Coming Soon', 'Manual IP connection will be available soon');
  };

  // Filter out current user from connected clients
  const otherClients = connectedClients.filter(client => client.id !== user?.id);

  const renderStatusBadge = () => {
    const statusColors = {
      connected: '#4CD964',
      connecting: '#FF9500',
      disconnected: '#999',
      error: '#FF3B30',
    };

    const statusLabels = {
      connected: 'Connected',
      connecting: 'Connecting...',
      disconnected: 'Disconnected',
      error: 'Error',
    };

    return (
      <View style={[styles.statusBadge, { backgroundColor: statusColors[status] }]}>
        <Text style={styles.statusText}>{statusLabels[status]}</Text>
      </View>
    );
  };

  const renderClient = ({ item }: { item: ConnectedClient }) => (
    <TouchableOpacity
      style={styles.clientItem}
      onPress={() => handleStartChat(item)}
      activeOpacity={0.7}
    >
      <View style={styles.clientAvatar}>
        <Ionicons name="person-circle" size={48} color="#007AFF" />
      </View>
      <View style={styles.clientInfo}>
        <Text style={styles.clientName}>{item.username}</Text>
        <Text style={styles.clientId}>{item.id.substring(0, 16)}...</Text>
      </View>
      <Ionicons name="chatbubble" size={24} color="#007AFF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        {renderStatusBadge()}
        <View style={styles.actions}>
          {status === 'disconnected' && (
            <TouchableOpacity style={styles.actionButton} onPress={handleConnect}>
              <Ionicons name="power" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>Connect</Text>
            </TouchableOpacity>
          )}
          {status === 'connected' && (
            <TouchableOpacity style={styles.actionButton} onPress={handleRefresh}>
              <Ionicons name="refresh" size={20} color="#007AFF" />
              <Text style={styles.actionButtonText}>Refresh</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {status === 'connected' ? (
        otherClients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#999" />
            <Text style={styles.emptyTitle}>No users nearby</Text>
            <Text style={styles.emptySubtitle}>
              Make sure other devices are connected to the same network
            </Text>
          </View>
        ) : (
          <FlatList
            data={otherClients}
            keyExtractor={(item) => item.id}
            renderItem={renderClient}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : (
        <View style={styles.centerContainer}>
          {status === 'connecting' ? (
            <>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.centerText}>Connecting to network...</Text>
            </>
          ) : (
            <>
              <Ionicons name="wifi-outline" size={64} color="#999" />
              <Text style={styles.centerTitle}>Not connected</Text>
              <Text style={styles.centerSubtitle}>
                Connect to discover nearby users
              </Text>
            </>
          )}
        </View>
      )}

      {/* Manual IP section (for web fallback) */}
      <View style={styles.manualSection}>
        <Text style={styles.manualTitle}>Manual Connection</Text>
        <View style={styles.manualInputContainer}>
          <TextInput
            style={styles.manualInput}
            placeholder="Enter IP address (e.g., 192.168.1.100)"
            placeholderTextColor="#999"
            value={manualIp}
            onChangeText={setManualIp}
            keyboardType="numbers-and-punctuation"
          />
          <TouchableOpacity
            style={styles.manualButton}
            onPress={handleManualConnect}
          >
            <Text style={styles.manualButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  clientAvatar: {
    marginRight: 12,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  clientId: {
    fontSize: 14,
    color: '#666',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centerText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  centerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  centerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  manualSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  manualTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  manualInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  manualButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  manualButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
