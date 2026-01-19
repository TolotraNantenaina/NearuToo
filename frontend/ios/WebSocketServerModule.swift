//
//  WebSocketServerModule.swift
//  Nearu
//
//  Created on 2025
//

import Foundation
import Network

@objc(WebSocketServerModule)
class WebSocketServerModule: RCTEventEmitter {
    
    private var listener: NWListener?
    private var connections: [String: ConnectionInfo] = [:]
    private var isRunning = false
    private let queue = DispatchQueue(label: "com.nearu.websocket.server")
    
    struct ConnectionInfo {
        let connection: NWConnection
        let userId: String
        let username: String
        let deviceId: String
        let connectedAt: Date
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    override func supportedEvents() -> [String]! {
        return [
            "onClientConnected",
            "onClientDisconnected",
            "onMessageReceived",
            "onServerStarted",
            "onServerStopped",
            "onServerError"
        ]
    }
    
    @objc
    func startServer(_ port: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        
        if isRunning {
            reject("ALREADY_RUNNING", "Server is already running", nil)
            return
        }
        
        do {
            let parameters = NWParameters.tcp
            parameters.allowLocalEndpointReuse = true
            
            // Enable WebSocket upgrade
            let wsOptions = NWProtocolWebSocket.Options()
            parameters.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)
            
            let portNum = NWEndpoint.Port(rawValue: UInt16(truncating: port))!
            listener = try NWListener(using: parameters, on: portNum)
            
            listener?.stateUpdateHandler = { [weak self] newState in
                switch newState {
                case .ready:
                    print("[WebSocketServer] Server ready on port \(port)")
                    self?.isRunning = true
                    self?.sendEvent(withName: "onServerStarted", body: ["port": port])
                    resolve([
                        "success": true,
                        "port": port,
                        "message": "Server started on port \(port)"
                    ])
                    
                case .failed(let error):
                    print("[WebSocketServer] Server failed: \(error)")
                    self?.isRunning = false
                    self?.sendEvent(withName: "onServerError", body: ["error": error.localizedDescription])
                    reject("START_ERROR", "Server failed: \(error.localizedDescription)", error)
                    
                case .cancelled:
                    print("[WebSocketServer] Server cancelled")
                    self?.isRunning = false
                    self?.sendEvent(withName: "onServerStopped", body: nil)
                    
                default:
                    break
                }
            }
            
            listener?.newConnectionHandler = { [weak self] newConnection in
                self?.handleNewConnection(newConnection)
            }
            
            listener?.start(queue: queue)
            
        } catch {
            print("[WebSocketServer] Failed to start: \(error)")
            reject("START_ERROR", "Failed to start server: \(error.localizedDescription)", error)
        }
    }
    
    @objc
    func stopServer(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        
        listener?.cancel()
        listener = nil
        
        // Close all connections
        for (_, info) in connections {
            info.connection.cancel()
        }
        connections.removeAll()
        
        isRunning = false
        
        sendEvent(withName: "onServerStopped", body: nil)
        
        resolve([
            "success": true,
            "message": "Server stopped"
        ])
    }
    
    @objc
    func isServerRunning(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        resolve(isRunning)
    }
    
    @objc
    func getConnectedClients(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
        var clients: [[String: Any]] = []
        
        for (_, info) in connections {
            clients.append([
                "userId": info.userId,
                "username": info.username,
                "deviceId": info.deviceId,
                "connectedAt": info.connectedAt.timeIntervalSince1970 * 1000
            ])
        }
        
        resolve(clients)
    }
    
    @objc
    func broadcastMessage(_ message: String, excludeUserId: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        
        var sentCount = 0
        
        for (userId, info) in connections {
            if userId != excludeUserId {
                sendWebSocketMessage(message, to: info.connection)
                sentCount += 1
            }
        }
        
        resolve([
            "success": true,
            "sentCount": sentCount
        ])
    }
    
    // MARK: - Private Methods
    
    private func handleNewConnection(_ connection: NWConnection) {
        print("[WebSocketServer] New connection")
        
        connection.stateUpdateHandler = { [weak self] newState in
            switch newState {
            case .ready:
                print("[WebSocketServer] Connection ready")
                self?.sendConfigMessage(to: connection)
                self?.receiveMessage(from: connection, userId: nil)
                
            case .failed(let error):
                print("[WebSocketServer] Connection failed: \(error)")
                
            case .cancelled:
                print("[WebSocketServer] Connection cancelled")
                
            default:
                break
            }
        }
        
        connection.start(queue: queue)
    }
    
    private func sendConfigMessage(to connection: NWConnection) {
        let config: [String: Any] = [
            "type": "CONFIG",
            "payload": [
                "serverVersion": "1.0.0",
                "protocolVersion": "1.0"
            ],
            "timestamp": Date().timeIntervalSince1970 * 1000
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: config),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            sendWebSocketMessage(jsonString, to: connection)
        }
    }
    
    private func sendWebSocketMessage(_ message: String, to connection: NWConnection) {
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(
            identifier: "textMessage",
            metadata: [metadata]
        )
        
        connection.send(
            content: message.data(using: .utf8),
            contentContext: context,
            isComplete: true,
            completion: .contentProcessed { error in
                if let error = error {
                    print("[WebSocketServer] Send error: \(error)")
                }
            }
        )
    }
    
    private func receiveMessage(from connection: NWConnection, userId: String?) {
        connection.receiveMessage { [weak self] (data, context, isComplete, error) in
            guard let self = self else { return }
            
            if let error = error {
                print("[WebSocketServer] Receive error: \(error)")
                return
            }
            
            if let data = data, !data.isEmpty {
                if let message = String(data: data, encoding: .utf8) {
                    print("[WebSocketServer] Received: \(message)")
                    self.handleMessage(message, from: connection, currentUserId: userId)
                }
            }
            
            // Continue receiving
            if userId != nil {
                self.receiveMessage(from: connection, userId: userId)
            }
        }
    }
    
    private func handleMessage(_ message: String, from connection: NWConnection, currentUserId: String?) {
        guard let data = message.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }
        
        switch type {
        case "HELLO":
            handleHelloMessage(json, connection: connection)
            
        case "MESSAGE":
            if let userId = currentUserId {
                handleChatMessage(json, fromUserId: userId)
            }
            
        case "REQUEST_CLIENTS":
            sendClientsUpdate(to: connection)
            
        default:
            break
        }
    }
    
    private func handleHelloMessage(_ json: [String: Any], connection: NWConnection) {
        guard let payload = json["payload"] as? [String: Any],
              let userId = payload["userId"] as? String,
              let username = payload["username"] as? String,
              let deviceId = payload["deviceId"] as? String else {
            return
        }
        
        // Store connection
        let info = ConnectionInfo(
            connection: connection,
            userId: userId,
            username: username,
            deviceId: deviceId,
            connectedAt: Date()
        )
        connections[userId] = info
        
        // Send HELLO_ACK
        let helloAck: [String: Any] = [
            "type": "HELLO_ACK",
            "payload": [
                "userId": userId,
                "status": "connected",
                "connectedClients": getConnectedClientsArray()
            ],
            "timestamp": Date().timeIntervalSince1970 * 1000
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: helloAck),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            sendWebSocketMessage(jsonString, to: connection)
        }
        
        // Notify React Native
        sendEvent(withName: "onClientConnected", body: [
            "userId": userId,
            "username": username,
            "deviceId": deviceId
        ])
        
        // Broadcast CLIENTS to others
        broadcastClientsUpdate(excludeUserId: userId)
        
        // Start receiving messages from this user
        receiveMessage(from: connection, userId: userId)
    }
    
    private func handleChatMessage(_ json: [String: Any], fromUserId: String) {
        guard let payload = json["payload"] as? [String: Any],
              let participants = payload["participants"] as? [String] else {
            return
        }
        
        // Convert back to JSON string
        if let jsonData = try? JSONSerialization.data(withJSONObject: json),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            
            // Broadcast to participants
            for participantId in participants {
                if participantId != fromUserId,
                   let info = connections[participantId] {
                    sendWebSocketMessage(jsonString, to: info.connection)
                }
            }
            
            // Notify React Native
            sendEvent(withName: "onMessageReceived", body: [
                "message": jsonString,
                "fromUserId": fromUserId
            ])
        }
    }
    
    private func sendClientsUpdate(to connection: NWConnection) {
        let clientsMessage: [String: Any] = [
            "type": "CLIENTS",
            "payload": [
                "clients": getConnectedClientsArray()
            ],
            "timestamp": Date().timeIntervalSince1970 * 1000
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: clientsMessage),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            sendWebSocketMessage(jsonString, to: connection)
        }
    }
    
    private func broadcastClientsUpdate(excludeUserId: String?) {
        let clientsMessage: [String: Any] = [
            "type": "CLIENTS",
            "payload": [
                "clients": getConnectedClientsArray()
            ],
            "timestamp": Date().timeIntervalSince1970 * 1000
        ]
        
        if let jsonData = try? JSONSerialization.data(withJSONObject: clientsMessage),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            
            for (userId, info) in connections {
                if userId != excludeUserId {
                    sendWebSocketMessage(jsonString, to: info.connection)
                }
            }
        }
    }
    
    private func getConnectedClientsArray() -> [[String: Any]] {
        var clients: [[String: Any]] = []
        
        for (_, info) in connections {
            clients.append([
                "id": info.userId,
                "userId": info.userId,
                "username": info.username,
                "deviceId": info.deviceId,
                "lastSeen": Date().timeIntervalSince1970 * 1000
            ])
        }
        
        return clients
    }
}