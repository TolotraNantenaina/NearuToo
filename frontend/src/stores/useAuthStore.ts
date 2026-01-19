import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface User {
  id: string;
  deviceId: string;
  username: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User) => void;
  logout: () => void;
  initialize: () => Promise<void>;
}

// Generate a unique device ID
const generateDeviceId = (): string => {
  return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

// Generate a unique user ID
const generateUserId = (): string => {
  return `user-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user: User) => {
    set({ user });
    if (Platform.OS !== 'web') {
      AsyncStorage.setItem('nearu_user', JSON.stringify(user));
    } else {
      localStorage.setItem('nearu_user', JSON.stringify(user));
    }
  },

  logout: () => {
    set({ user: null });
    if (Platform.OS !== 'web') {
      AsyncStorage.removeItem('nearu_user');
    } else {
      localStorage.removeItem('nearu_user');
    }
  },

  initialize: async () => {
    try {
      let userStr: string | null = null;
      
      if (Platform.OS !== 'web') {
        userStr = await AsyncStorage.getItem('nearu_user');
      } else {
        userStr = localStorage.getItem('nearu_user');
      }

      if (userStr) {
        const user = JSON.parse(userStr);
        set({ user, isLoading: false });
      } else {
        // Create new user
        const newUser: User = {
          id: generateUserId(),
          deviceId: generateDeviceId(),
          username: `User${Math.floor(Math.random() * 1000)}`
        };
        
        set({ user: newUser, isLoading: false });
        
        if (Platform.OS !== 'web') {
          await AsyncStorage.setItem('nearu_user', JSON.stringify(newUser));
        } else {
          localStorage.setItem('nearu_user', JSON.stringify(newUser));
        }
      }
    } catch (error) {
      console.error('Error initializing user:', error);
      set({ isLoading: false });
    }
  },
}));
