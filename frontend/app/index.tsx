import { Text, View, StyleSheet } from "react-native";
import { Redirect } from "expo-router";

export default function Index() {
  // Redirect to setup/chats based on user state
  // The _layout.tsx will handle the actual navigation
  return <Redirect href="/(tabs)/chats" />;
}
