import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/useAuthStore';
import { clearAllData } from '../../src/database/sqlite';
import { useChatStore } from '../../src/stores/useChatStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { clearAll } = useChatStore();

  const handleEditUsername = () => {
    Alert.prompt(
      'Edit Username',
      'Enter your new username:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (newUsername) => {
            if (newUsername && newUsername.trim() && user) {
              const updatedUser = { ...user, username: newUsername.trim() };
              setUser(updatedUser);
              Alert.alert('Success', 'Username updated successfully');
            }
          },
        },
      ],
      'plain-text',
      user?.username
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all chats and messages. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              clearAll();
              Alert.alert('Success', 'All data cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const SettingItem = ({
    icon,
    title,
    value,
    onPress,
    showChevron = true,
    destructive = false,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    value?: string;
    onPress?: () => void;
    showChevron?: boolean;
    destructive?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <Ionicons
          name={icon}
          size={24}
          color={destructive ? '#FF3B30' : '#007AFF'}
        />
        <Text style={[styles.settingTitle, destructive && styles.destructiveText]}>
          {title}
        </Text>
      </View>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {showChevron && onPress && (
          <Ionicons name="chevron-forward" size={20} color="#999" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView>
        {/* User Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Info</Text>
          <View style={styles.card}>
            <SettingItem
              icon="person"
              title="Username"
              value={user?.username}
              onPress={handleEditUsername}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="id-card"
              title="User ID"
              value={user?.id.substring(0, 16) + '...'}
              showChevron={false}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="phone-portrait"
              title="Device ID"
              value={user?.deviceId.substring(0, 16) + '...'}
              showChevron={false}
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <SettingItem
              icon="information-circle"
              title="Version"
              value="1.0.0"
              showChevron={false}
            />
            <View style={styles.divider} />
            <SettingItem
              icon="wifi"
              title="Network"
              value="Local LAN"
              showChevron={false}
            />
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.card}>
            <SettingItem
              icon="trash"
              title="Clear All Data"
              onPress={handleClearData}
              destructive
            />
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="lock-closed" size={20} color="#007AFF" />
          <Text style={styles.infoText}>
            Nearu is a local network chat app. All your data stays on your device
            and is never sent to the cloud.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#000',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 15,
    color: '#666',
  },
  destructiveText: {
    color: '#FF3B30',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginLeft: 52,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});
