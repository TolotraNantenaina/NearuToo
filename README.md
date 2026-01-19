# Nearu - Chat Local LAN

Application de chat local fonctionnant sur réseau LAN (Wi-Fi/Ethernet), sans nécessiter de connexion Internet.

## 🎯 Caractéristiques

- **Communication temps réel** via WebSocket
- **Découverte de pairs** sur le réseau local
- **Chats directs 1-to-1**
- **Stockage local** avec SQLite (mobile) / mémoire (web)
- **Offline-first** : toutes les données restent sur l'appareil
- **Multi-plateforme** : Android, iOS, Web

## 🏗️ Architecture

### Backend (FastAPI)
- **WebSocket** : `/api/ws` - Communication temps réel
- **REST API** :
  - `GET /api/chats` - Liste des conversations
  - `GET /api/chats/{chatId}/messages` - Messages d'un chat
  - `GET /api/probe` - Endpoint de découverte réseau
- **MongoDB** : Stockage serveur (facultatif, pour synchronisation)

### Frontend (React Native / Expo)
- **Stores (Zustand)** : State management
- **SQLite** : Stockage local (native)
- **WebSocket Hook** : Gestion connexion/reconnexion
- **Screens** :
  - Chats : Liste des conversations
  - Discover : Découverte de pairs
  - Chat : Conversation 1-to-1
  - Settings : Configuration utilisateur

## 📦 Stack Technique

- **Frontend** : React Native, Expo SDK 54, expo-router
- **Backend** : FastAPI, Python 3.11
- **Base de données** : MongoDB (serveur), SQLite (local)
- **Communication** : WebSocket (protocole WireEnvelope)
- **State** : Zustand

## 🚀 URL d'accès

- **Web App** : https://proxichat-84.preview.emergentagent.com
- **API Backend** : https://proxichat-84.preview.emergentagent.com/api
- **WebSocket** : wss://proxichat-84.preview.emergentagent.com/api/ws

## 🔌 Protocole WebSocket

### Handshake
1. **Serveur → Client** : `CONFIG` (version protocole)
2. **Client → Serveur** : `HELLO` (userId, deviceId, username)
3. **Serveur → Client** : `HELLO_ACK` (confirmation + liste clients)

### Types de messages
- `MESSAGE` : Message de chat
- `CLIENTS` : Liste des clients connectés
- `REQUEST_CLIENTS` : Demande de liste clients
- `SYSTEM` : Messages système

## 📱 Fonctionnalités Implémentées

### ✅ Phase 1 : Infrastructure WebSocket + Handshake
- [x] Backend WebSocket endpoint
- [x] Protocole handshake (CONFIG → HELLO → HELLO_ACK)
- [x] Hook useWebSocket avec auto-reconnect
- [x] Gestion des connexions actives

### ✅ Phase 2 : Chat Direct 1-to-1
- [x] Modèles Message & Chat
- [x] Envoi/réception temps réel
- [x] Status messages (sending → delivered)
- [x] UI MessageBubble, MessageInput
- [x] Screens ChatList, Chat

### ✅ Phase 3 : Stockage Local SQLite
- [x] expo-sqlite (native)
- [x] Tables users, chats, messages
- [x] UPSERT messages par id
- [x] Fallback mémoire (web)
- [x] dbVersion pour refresh UI

### 🔄 Phase 4 : Découverte LAN (Interface prête)
- [ ] react-native-zeroconf (mDNS mobile) - Nécessite Dev Client
- [x] Endpoint HTTP probe
- [x] Saisie manuelle IP (interface)
- [x] UI Discover screen
- [x] Connexion WebSocket automatique

### 🚧 Phase 5 : Groupes (À venir)
- [ ] Chats de groupe multi-participants
- [ ] Gestion des membres
- [ ] UI création groupe

## 🎯 Utilisation

1. **Ouvrir l'application web** : https://proxichat-84.preview.emergentagent.com
2. **Choisir un nom d'utilisateur** lors du premier lancement
3. **Aller dans l'onglet "Discover"** pour se connecter au réseau
4. **Cliquer sur "Connect"** pour établir la connexion WebSocket
5. **Les autres utilisateurs connectés apparaîtront** dans la liste
6. **Cliquer sur un utilisateur** pour démarrer une conversation
7. **Envoyer des messages** en temps réel !

## 📝 Notes Importantes

1. **Web** : 
   - Fonctionne immédiatement dans le navigateur
   - Stockage en mémoire (données perdues au refresh)
   - Pas de mDNS natif (connexion manuelle)

2. **Mobile** (nécessite Dev Client) :
   - SQLite pour stockage persistant
   - react-native-zeroconf pour découverte mDNS
   - Build requis : `eas build --platform android`

3. **Sécurité** :
   - Communication locale uniquement
   - Pas de chiffrement implémenté
   - À améliorer pour production

## 🐛 Troubleshooting

### WebSocket ne se connecte pas
- Vérifier que vous êtes sur la même page/onglet
- Rafraîchir la page
- Vérifier la console navigateur pour erreurs

### Messages ne s'affichent pas
- Vérifier que vous êtes connecté (badge vert dans Discover)
- Essayer de se reconnecter
- Vérifier que l'autre utilisateur est en ligne

## 📄 License

MIT
