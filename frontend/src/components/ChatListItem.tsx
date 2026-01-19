import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Chat } from '../stores/useChatStore';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

interface ChatListItemProps {
  chat: Chat;
  onPress: () => void;
  currentUserId: string;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({ chat, onPress, currentUserId }) => {
  // Get other participant(s) for display
  const otherParticipants = chat.participants.filter(p => p !== currentUserId);
  const displayName = otherParticipants
    .map(id => chat.participantNames?.[id] || id.substring(0, 8))
    .join(', ') || 'Unknown';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Ionicons name="person-circle" size={48} color="#007AFF" />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.time}>
            {format(new Date(chat.updatedAt), 'HH:mm')}
          </Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {chat.lastMessage || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  avatar: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  time: {
    fontSize: 14,
    color: '#999',
  },
  lastMessage: {
    fontSize: 15,
    color: '#666',
  },
});
