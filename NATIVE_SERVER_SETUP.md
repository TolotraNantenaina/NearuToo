# 🚀 Configuration Serveur WebSocket Natif - Guide Complet

## 📋 Vue d'ensemble

Cette documentation explique comment configurer et builder l'application Nearu avec le **serveur WebSocket natif** pour Android et iOS.

---

## 📱 Architecture P2P

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Mobile 1      │         │   Mobile 2      │         │   Mobile 3      │
│                 │         │                 │         │                 │
│  [WS Server]◄───┼─────────┤  [WS Client]    │         │  [WS Client]    │
│  [WS Client]    │         │                 │         │                 │
│  Port: 45454    │         │  → 192.168.1.10 │         │  → 192.168.1.10 │
│  IP: 192.168.1.│         │                 │         │                 │
│      .10        │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
        ▲                            │                            │
        │                            │                            │
        └────────────────────────────┴────────────────────────────┘
                    Réseau Local (WiFi/Ethernet)
```

---

## ⚙️ Configuration Android

### 1️⃣ **Ajouter les dépendances Ktor**

Éditez `/android/app/build.gradle` :

```gradle
dependencies {
    // ... dépendances existantes
    
    // Ktor WebSocket Server
    implementation "io.ktor:ktor-server-core:2.3.7"
    implementation "io.ktor:ktor-server-netty:2.3.7"
    implementation "io.ktor:ktor-server-websockets:2.3.7"
    implementation "io.ktor:ktor-serialization-kotlinx-json:2.3.7"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3"
}
```

### 2️⃣ **Enregistrer le module natif**

Éditez `/android/app/src/main/java/com/nearu/MainApplication.kt` ou `.java` :

**Pour MainApplication.kt (Kotlin)** :
```kotlin
import com.nearu.websocket.WebSocketServerPackage

override fun getPackages(): List<ReactPackage> {
    return PackageList(this).packages.apply {
        add(WebSocketServerPackage())  // Ajouter cette ligne
    }
}
```

**Pour MainApplication.java (Java)** :
```java
import com.nearu.websocket.WebSocketServerPackage;

@Override
protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    packages.add(new WebSocketServerPackage());  // Ajouter cette ligne
    return packages;
}
```

### 3️⃣ **Permissions réseau Android**

Éditez `/android/app/src/main/AndroidManifest.xml` :

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Permissions réseau -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
    <uses-permission android:name="android.permission.CHANGE_NETWORK_STATE" />
    
    <application>
        <!-- Autoriser le trafic en clair (pour développement local) -->
        <application
            android:usesCleartextTraffic="true"
            android:networkSecurityConfig="@xml/network_security_config">
        </application>
    </application>
</manifest>
```

Créer `/android/app/src/main/res/xml/network_security_config.xml` :

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
```

### 4️⃣ **app.json configuration**

Mettre à jour `/frontend/app.json` :

```json
{
  "expo": {
    "android": {
      "package": "com.nearu.app",
      "permissions": [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "ACCESS_WIFI_STATE",
        "CHANGE_WIFI_MULTICAST_STATE",
        "CHANGE_NETWORK_STATE"
      ]
    }
  }
}
```

---

## 🍎 Configuration iOS

### 1️⃣ **Ajouter le fichier Swift au projet**

Les fichiers sont déjà créés :
- `/frontend/ios/WebSocketServerModule.swift`
- `/frontend/ios/WebSocketServerModule.m`

### 2️⃣ **Créer le Bridging Header**

Créer `/frontend/ios/Nearu-Bridging-Header.h` :

```objc
//
//  Use this file to import your target's public headers that you would like to expose to Swift.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
```

### 3️⃣ **Configurer Xcode**

1. Ouvrir `/frontend/ios/Nearu.xcworkspace` dans Xcode
2. Sélectionner le projet **Nearu** dans le navigator
3. Aller dans **Build Settings**
4. Chercher "Objective-C Bridging Header"
5. Définir : `Nearu/Nearu-Bridging-Header.h`

### 4️⃣ **Info.plist - Permissions réseau**

Éditer `/frontend/ios/Nearu/Info.plist` :

```xml
<key>NSLocalNetworkUsageDescription</key>
<string>Nearu a besoin d'accéder au réseau local pour communiquer avec d'autres appareils</string>

<key>NSBonjourServices</key>
<array>
    <string>_nearu._tcp</string>
</array>
```

### 5️⃣ **Capacités réseau iOS**

Dans Xcode :
1. Sélectionner le target **Nearu**
2. Aller dans **Signing & Capabilities**
3. Cliquer **+ Capability**
4. Ajouter **"Multipath"** (si nécessaire pour P2P)

---

## 🔧 Installation des Dépendances

### Frontend
```bash
cd /app/frontend

# Installer les nouvelles dépendances
yarn add @react-native-community/netinfo

# iOS uniquement
cd ios
pod install
cd ..
```

---

## 📦 Build avec EAS

### 1️⃣ **Configuration eas.json**

Créer ou mettre à jour `/frontend/eas.json` :

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug",
        "buildType": "apk"
      },
      "ios": {
        "buildConfiguration": "Debug",
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "buildConfiguration": "Release"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 2️⃣ **Build Android Dev Client**

```bash
cd /app/frontend

# Installer EAS CLI (si nécessaire)
npm install -g eas-cli

# Login EAS
eas login

# Configurer le projet
eas build:configure

# Build Android Dev Client
eas build --platform android --profile development

# OU build APK local
cd android
./gradlew assembleDebug

# APK sera dans: android/app/build/outputs/apk/debug/app-debug.apk
```

### 3️⃣ **Build iOS Dev Client**

```bash
# Build iOS Dev Client
eas build --platform ios --profile development

# OU build local avec Xcode
# Ouvrir ios/Nearu.xcworkspace et Run
```

---

## 🧪 Tester le Serveur

### 1️⃣ **Installer l'app sur 2 appareils**

```bash
# Installer l'APK sur Android
adb install app-debug.apk

# Ou télécharger depuis EAS et scanner QR code
```

### 2️⃣ **Test Mode Serveur**

**Sur l'appareil 1 (Serveur)** :
1. Ouvrir Nearu
2. Aller dans "Server Mode" (nouvelle route `/server-mode`)
3. Cliquer "Devenir Serveur"
4. Noter l'adresse IP affichée (ex: `192.168.1.10`)

**Sur l'appareil 2 (Client)** :
1. Ouvrir Nearu
2. Aller dans "Discover"
3. Entrer l'IP du serveur : `192.168.1.10`
4. Port : `45454`
5. Cliquer "Connect"

### 3️⃣ **Envoyer un message**

1. Sur l'appareil 2, sélectionner le serveur dans la liste
2. Commencer un chat
3. Envoyer un message
4. Le message devrait apparaître sur l'appareil 1

---

## 🎯 Utilisation dans le Code

### Démarrer le serveur

```typescript
import { NativeWebSocketServer } from './src/native/NativeWebSocketServer';

// Démarrer serveur
const result = await NativeWebSocketServer.startServer(45454);
console.log(result); // { success: true, port: 45454, message: "..." }

// Vérifier status
const isRunning = await NativeWebSocketServer.isServerRunning();

// Obtenir clients connectés
const clients = await NativeWebSocketServer.getConnectedClients();

// Broadcaster un message
await NativeWebSocketServer.broadcastMessage(
  JSON.stringify({ type: "MESSAGE", payload: {...} }),
  excludeUserId
);

// Arrêter serveur
await NativeWebSocketServer.stopServer();
```

### Utiliser le Hook

```typescript
import { useNativeServer } from './src/hooks/useNativeServer';

function MyComponent() {
  const {
    mode,                    // 'none' | 'server' | 'client'
    isServerRunning,
    connectedClients,
    localIp,
    startServer,
    stopServer,
    connectToServer,
    disconnectFromServer,
    clientStatus,
  } = useNativeServer({
    port: 45454,
    autoConnectToSelf: true,
  });

  return (
    <View>
      <Button onPress={startServer}>Start Server</Button>
      <Text>Connected: {connectedClients.length}</Text>
    </View>
  );
}
```

### Écouter les événements

```typescript
useEffect(() => {
  const unsubscribe = NativeWebSocketServer.addEventListener(
    'onClientConnected',
    (event) => {
      console.log('Client connected:', event.username);
    }
  );

  return unsubscribe;
}, []);
```

---

## 🐛 Troubleshooting

### Android : Module non trouvé

**Erreur** : `NativeModule: WebSocketServer is null`

**Solution** :
1. Vérifier que `WebSocketServerPackage` est ajouté dans `MainApplication`
2. Rebuild complètement : `cd android && ./gradlew clean && cd .. && yarn android`
3. Vérifier que vous utilisez un Dev Client (pas Expo Go)

### iOS : Bridging Header

**Erreur** : `Use of undeclared type 'RCTBridgeModule'`

**Solution** :
1. Vérifier le Bridging Header path dans Build Settings
2. S'assurer que les imports sont corrects
3. Clean build folder : Cmd+Shift+K dans Xcode

### Serveur ne démarre pas

**Erreur** : Port 45454 déjà utilisé

**Solution** :
```bash
# Android
adb shell netstat -an | grep 45454
adb shell su -c "kill <PID>"

# iOS : Redémarrer l'app
```

### Pas de connexion entre appareils

**Solution** :
1. Vérifier que les 2 appareils sont sur le **même réseau WiFi**
2. Désactiver les pare-feu / VPN
3. Vérifier l'adresse IP : `Settings > WiFi > Info`
4. Tester la connectivité : `ping 192.168.1.10`

---

## 📚 Ressources

- [Ktor Documentation](https://ktor.io/docs/server-websockets.html)
- [React Native Modules](https://reactnative.dev/docs/native-modules-android)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Network Framework (iOS)](https://developer.apple.com/documentation/network)

---

## ✅ Checklist de Déploiement

- [ ] Dépendances Ktor ajoutées (Android)
- [ ] Module enregistré dans MainApplication
- [ ] Permissions AndroidManifest.xml
- [ ] Bridging Header configuré (iOS)
- [ ] Info.plist avec permissions réseau
- [ ] @react-native-community/netinfo installé
- [ ] Build Dev Client réussi
- [ ] Test sur 2 appareils réels
- [ ] Connexion P2P fonctionnelle
- [ ] Messages transmis correctement

---

**🎉 Votre app Nearu est maintenant prête pour la communication P2P !**
