import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore, Message } from '../../src/stores/useChatStore';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { useWebSocket } from '../../src/hooks/useWebSocket';
import { getMessages, saveChat } from '../../src/database/sqlite';
import { MessageBubble } from '../../src/components/MessageBubble';
import { MessageInput } from '../../src/components/MessageInput';
import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { chats, messages, addMessage } = useChatStore();
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Find chat
  const chat = chats.find(c => c.id === chatId);
  const chatMessages = messages[chatId || ''] || [];

  // Get other participant name
  const otherParticipants = chat?.participants.filter(p => p !== user?.id) || [];
  const displayName = otherParticipants
    .map(id => chat?.participantNames?.[id] || id.substring(0, 8))
    .join(', ') || 'Chat';

  // WebSocket connection
  const wsUrl = BACKEND_URL?.replace(/^http/, 'ws') + '/api/ws' || 'ws://localhost:8001/api/ws';
  const { status, sendChatMessage, connect } = useWebSocket({
    url: wsUrl,
    autoConnect: false,
  });

  useEffect(() => {
    // Connect WebSocket
    if (user) {
      connect();
    }

    // Load messages from database
    const loadMessages = async () => {
      if (chatId) {
        try {
          const dbMessages = await getMessages(chatId, 100);
          // Add to store
          dbMessages.forEach(msg => addMessage(msg));
        } catch (error) {
          console.error('Error loading messages:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadMessages();
  }, [chatId, user]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages.length]);

  const handleSendMessage = async (content: string) => {
    if (!chat || !user) return;

    await sendChatMessage(chat.id, content, chat.participants);

    // Update chat in database
    await saveChat({
      ...chat,
      lastMessage: content,
      updatedAt: Date.now(),
    });

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  if (!chat) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#FF3B30" />
        <Text style={styles.errorText}>Chat not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: displayName,
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerLeft: () => (
            <Ionicons
              name="arrow-back"
              size={24}
              color="#FFFFFF"
              onPress={() => router.back()}
              style={{ marginLeft: 16 }}
            />
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : chatMessages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#999" />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isOwn={item.senderId === user?.id}
                />
              )}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          )}
          <MessageInput onSend={handleSendMessage} />
        </KeyboardAvoidingView>

        {/* Connection status indicator */}
        {status !== 'connected' && (
          <View style={styles.connectionBanner}>
            <Text style={styles.connectionText}>
              {status === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  messagesList: {
    paddingVertical: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF3B30',
    marginTop: 16,
  },
  connectionBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF9500',
    paddingVertical: 8,
    alignItems: 'center',
  },
  connectionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
