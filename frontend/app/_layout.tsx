import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../src/stores/useAuthStore';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isLoading, initialize } = useAuthStore();

  // Initialize user and database
  useEffect(() => {
    const init = async () => {
      try {
        // Only initialize database on native platforms
        if (Platform.OS !== 'web') {
          const { initDatabase } = await import('../src/database/sqlite');
          await initDatabase();
        }
        await initialize();
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    
    init();
  }, []);

  // Navigate based on user state
  useEffect(() => {
    if (isLoading) return;

    const inApp = segments[0] === '(tabs)';

    if (!user && inApp) {
      // Redirect to setup if not initialized
      router.replace('/setup');
    } else if (user && !inApp) {
      // Redirect to main app if initialized
      router.replace('/(tabs)/chats');
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
