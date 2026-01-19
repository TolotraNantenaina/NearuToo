import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../stores/useChatStore';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
        <Text style={[styles.content, isOwn ? styles.ownContent : styles.otherContent]}>
          {message.content}
        </Text>
        <View style={styles.footer}>
          <Text style={[styles.timestamp, isOwn ? styles.ownTimestamp : styles.otherTimestamp]}>
            {format(new Date(message.timestamp), 'HH:mm')}
          </Text>
          {isOwn && (
            <Text style={styles.status}>
              {message.status === 'sending' ? '⏱' : message.status === 'delivered' ? '✓' : '✗'}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 16,
    maxWidth: '75%',
  },
  ownContainer: {
    alignSelf: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  ownBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  content: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownContent: {
    color: '#FFFFFF',
  },
  otherContent: {
    color: '#000000',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimestamp: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  status: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
