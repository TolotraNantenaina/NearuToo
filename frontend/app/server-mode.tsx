import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNativeServer } from '../../src/hooks/useNativeServer';
import { useAuthStore } from '../../src/stores/useAuthStore';

export default function ServerModeScreen() {
  const user = useAuthStore(state => state.user);
  const {
    mode,
    isServerRunning,
    connectedClients,
    localIp,
    startServer,
    stopServer,
    clientStatus,
  } = useNativeServer({
    port: 45454,
    autoConnectToSelf: true,
  });

  const handleStartServer = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Non disponible',
        'Le serveur WebSocket natif n\'est disponible que sur mobile (Dev Client requis)'
      );
      return;
    }

    const success = await startServer();
    if (success) {
      Alert.alert(
        'Serveur démarré',
        `Le serveur est actif sur ${localIp || 'votre appareil'}:45454`
      );
    } else {
      Alert.alert(
        'Erreur',
        'Impossible de démarrer le serveur. Assurez-vous d\'utiliser un Dev Client build.'
      );
    }
  };

  const handleStopServer = async () => {
    await stopServer();
    Alert.alert('Serveur arrêté', 'Le serveur a été arrêté avec succès');
  };

  const renderModeIndicator = () => {
    const modeInfo = {
      none: { label: 'Inactif', color: '#999', icon: 'radio-button-off' as const },
      server: { label: 'Mode Serveur', color: '#4CD964', icon: 'radio-button-on' as const },
      client: { label: 'Mode Client', color: '#007AFF', icon: 'radio-button-on' as const },
    };

    const info = modeInfo[mode];

    return (
      <View style={[styles.modeIndicator, { backgroundColor: info.color + '20' }]}>
        <Ionicons name={info.icon} size={24} color={info.color} />
        <Text style={[styles.modeText, { color: info.color }]}>{info.label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Mode Indicator */}
        {renderModeIndicator()}

        {/* Server Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serveur WebSocket P2P</Text>
          <Text style={styles.sectionDescription}>
            Transformez cet appareil en serveur pour permettre aux autres de se connecter
          </Text>

          {!isServerRunning ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartServer}>
              <Ionicons name="play-circle" size={24} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Devenir Serveur</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.serverInfo}>
                <View style={styles.infoRow}>
                  <Ionicons name="wifi" size={20} color="#007AFF" />
                  <Text style={styles.infoLabel}>Adresse IP locale:</Text>
                  <Text style={styles.infoValue}>{localIp || 'Chargement...'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="globe" size={20} color="#007AFF" />
                  <Text style={styles.infoLabel}>Port:</Text>
                  <Text style={styles.infoValue}>45454</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="people" size={20} color="#007AFF" />
                  <Text style={styles.infoLabel}>Clients connectés:</Text>
                  <Text style={styles.infoValue}>{connectedClients.length}</Text>
                </View>
              </View>

              {/* Connected Clients */}
              {connectedClients.length > 0 && (
                <View style={styles.clientsList}>
                  <Text style={styles.clientsTitle}>Clients connectés:</Text>
                  {connectedClients.map((client) => (
                    <View key={client.userId} style={styles.clientItem}>
                      <Ionicons name="person-circle" size={32} color="#007AFF" />
                      <View style={styles.clientInfo}>
                        <Text style={styles.clientName}>{client.username}</Text>
                        <Text style={styles.clientId}>
                          {client.userId.substring(0, 16)}...
                        </Text>
                      </View>
                      <View style={styles.statusDot} />
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, styles.stopButton]}
                onPress={handleStopServer}
              >
                <Ionicons name="stop-circle" size={24} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Arrêter le serveur</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Connection Status */}
        {mode === 'server' && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons
                name={clientStatus === 'connected' ? 'checkmark-circle' : 'time'}
                size={24}
                color={clientStatus === 'connected' ? '#4CD964' : '#FF9500'}
              />
              <Text style={styles.statusTitle}>
                {clientStatus === 'connected'
                  ? 'Connecté à soi-même'
                  : 'Connexion en cours...'}
              </Text>
            </View>
            <Text style={styles.statusDescription}>
              Le serveur se connecte automatiquement à lui-même en tant que client pour
              envoyer/recevoir des messages.
            </Text>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color="#007AFF" />
          <View style={styles.infoBoxContent}>
            <Text style={styles.infoBoxTitle}>Mode Serveur P2P</Text>
            <Text style={styles.infoBoxText}>
              • Votre appareil héberge le serveur WebSocket{'
'}
              • Les autres utilisateurs se connectent à votre IP{'
'}
              • Nécessite un Dev Client build (pas Expo Go){'
'}
              • Tous les appareils doivent être sur le même réseau
            </Text>
          </View>
        </View>

        {/* Platform Warning */}
        {Platform.OS === 'web' && (
          <View style={[styles.infoBox, { backgroundColor: '#FFF3CD' }]}>
            <Ionicons name="warning" size={24} color="#FF9500" />
            <View style={styles.infoBoxContent}>
              <Text style={[styles.infoBoxTitle, { color: '#FF9500' }]}>
                Non disponible sur Web
              </Text>
              <Text style={[styles.infoBoxText, { color: '#856404' }]}>
                Le serveur WebSocket natif nécessite une app mobile buildée avec un Dev
                Client. Utilisez Android ou iOS.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 16,
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  modeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  serverInfo: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  clientsList: {
    marginTop: 16,
  },
  clientsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginBottom: 8,
  },
  clientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  clientId: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CD964',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoBoxContent: {
    flex: 1,
  },
  infoBoxTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});
