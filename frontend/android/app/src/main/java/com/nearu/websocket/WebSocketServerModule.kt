package com.nearu.websocket

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

class WebSocketServerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var server: NettyApplicationEngine? = null
    private val connections = ConcurrentHashMap<String, ConnectionInfo>()
    private val connectionIdCounter = AtomicInteger(0)
    private var serverJob: Job? = null

    companion object {
        private const val TAG = "WebSocketServer"
        private const val EVENT_CLIENT_CONNECTED = "onClientConnected"
        private const val EVENT_CLIENT_DISCONNECTED = "onClientDisconnected"
        private const val EVENT_MESSAGE_RECEIVED = "onMessageReceived"
        private const val EVENT_SERVER_STARTED = "onServerStarted"
        private const val EVENT_SERVER_STOPPED = "onServerStopped"
        private const val EVENT_ERROR = "onServerError"
    }

    data class ConnectionInfo(
        val session: DefaultWebSocketSession,
        val userId: String,
        val username: String,
        val deviceId: String,
        val connectedAt: Long
    )

    override fun getName(): String = "WebSocketServer"

    @ReactMethod
    fun startServer(port: Int, promise: Promise) {
        if (server != null) {
            promise.reject("ALREADY_RUNNING", "Server is already running")
            return
        }

        try {
            Log.d(TAG, "Starting WebSocket server on port $port")

            server = embeddedServer(Netty, port = port, host = "0.0.0.0") {
                install(WebSockets) {
                    pingPeriod = java.time.Duration.ofSeconds(15)
                    timeout = java.time.Duration.ofSeconds(15)
                    maxFrameSize = Long.MAX_VALUE
                    masking = false
                }

                routing {
                    webSocket("/ws") {
                        val connectionId = connectionIdCounter.incrementAndGet().toString()
                        Log.d(TAG, "New WebSocket connection: $connectionId")

                        try {
                            // Send CONFIG message
                            val configMessage = JSONObject().apply {
                                put("type", "CONFIG")
                                put("payload", JSONObject().apply {
                                    put("serverVersion", "1.0.0")
                                    put("protocolVersion", "1.0")
                                })
                                put("timestamp", System.currentTimeMillis())
                            }
                            send(Frame.Text(configMessage.toString()))
                            Log.d(TAG, "Sent CONFIG to $connectionId")

                            // Wait for HELLO message
                            var userId: String? = null
                            var username: String? = null
                            var deviceId: String? = null

                            for (frame in incoming) {
                                if (frame is Frame.Text) {
                                    val text = frame.readText()
                                    Log.d(TAG, "Received from $connectionId: $text")

                                    try {
                                        val json = JSONObject(text)
                                        val type = json.getString("type")

                                        when (type) {
                                            "HELLO" -> {
                                                val payload = json.getJSONObject("payload")
                                                userId = payload.getString("userId")
                                                username = payload.getString("username")
                                                deviceId = payload.getString("deviceId")

                                                // Store connection
                                                connections[userId] = ConnectionInfo(
                                                    session = this,
                                                    userId = userId,
                                                    username = username,
                                                    deviceId = deviceId,
                                                    connectedAt = System.currentTimeMillis()
                                                )

                                                // Send HELLO_ACK
                                                val helloAck = JSONObject().apply {
                                                    put("type", "HELLO_ACK")
                                                    put("payload", JSONObject().apply {
                                                        put("userId", userId)
                                                        put("status", "connected")
                                                        put("connectedClients", getConnectedClientsJson())
                                                    })
                                                    put("timestamp", System.currentTimeMillis())
                                                }
                                                send(Frame.Text(helloAck.toString()))

                                                // Notify React Native
                                                sendEvent(EVENT_CLIENT_CONNECTED, Arguments.createMap().apply {
                                                    putString("userId", userId)
                                                    putString("username", username)
                                                    putString("deviceId", deviceId)
                                                })

                                                // Broadcast CLIENTS to others
                                                broadcastClientsUpdate(userId)

                                                Log.d(TAG, "Client $userId ($username) connected")
                                            }

                                            "MESSAGE" -> {
                                                if (userId != null) {
                                                    // Broadcast to participants
                                                    val payload = json.getJSONObject("payload")
                                                    val participants = payload.getJSONArray("participants")
                                                    
                                                    for (i in 0 until participants.length()) {
                                                        val participantId = participants.getString(i)
                                                        if (participantId != userId) {
                                                            connections[participantId]?.session?.send(
                                                                Frame.Text(text)
                                                            )
                                                        }
                                                    }

                                                    // Notify React Native
                                                    sendEvent(EVENT_MESSAGE_RECEIVED, Arguments.createMap().apply {
                                                        putString("message", text)
                                                        putString("fromUserId", userId)
                                                    })

                                                    Log.d(TAG, "Message from $userId broadcasted")
                                                }
                                            }

                                            "REQUEST_CLIENTS" -> {
                                                val clientsMessage = JSONObject().apply {
                                                    put("type", "CLIENTS")
                                                    put("payload", JSONObject().apply {
                                                        put("clients", getConnectedClientsJson())
                                                    })
                                                    put("timestamp", System.currentTimeMillis())
                                                }
                                                send(Frame.Text(clientsMessage.toString()))
                                            }
                                        }
                                    } catch (e: Exception) {
                                        Log.e(TAG, "Error processing message: ${e.message}")
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "WebSocket error: ${e.message}")
                        } finally {
                            // Clean up
                            if (userId != null) {
                                connections.remove(userId)
                                sendEvent(EVENT_CLIENT_DISCONNECTED, Arguments.createMap().apply {
                                    putString("userId", userId)
                                })
                                broadcastClientsUpdate(null)
                                Log.d(TAG, "Client $userId disconnected")
                            }
                        }
                    }
                }
            }

            serverJob = GlobalScope.launch {
                server?.start(wait = true)
            }

            sendEvent(EVENT_SERVER_STARTED, Arguments.createMap().apply {
                putInt("port", port)
            })

            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
                putInt("port", port)
                putString("message", "Server started on port $port")
            })

            Log.d(TAG, "Server started successfully on port $port")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start server: ${e.message}")
            promise.reject("START_ERROR", "Failed to start server: ${e.message}")
        }
    }

    @ReactMethod
    fun stopServer(promise: Promise) {
        try {
            server?.stop(1000, 2000)
            server = null
            serverJob?.cancel()
            serverJob = null
            connections.clear()

            sendEvent(EVENT_SERVER_STOPPED, null)

            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
                putString("message", "Server stopped")
            })

            Log.d(TAG, "Server stopped")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop server: ${e.message}")
            promise.reject("STOP_ERROR", "Failed to stop server: ${e.message}")
        }
    }

    @ReactMethod
    fun isServerRunning(promise: Promise) {
        promise.resolve(server != null)
    }

    @ReactMethod
    fun getConnectedClients(promise: Promise) {
        val clientsArray = Arguments.createArray()
        connections.forEach { (_, info) ->
            clientsArray.pushMap(Arguments.createMap().apply {
                putString("userId", info.userId)
                putString("username", info.username)
                putString("deviceId", info.deviceId)
                putDouble("connectedAt", info.connectedAt.toDouble())
            })
        }
        promise.resolve(clientsArray)
    }

    @ReactMethod
    fun broadcastMessage(message: String, excludeUserId: String?, promise: Promise) {
        try {
            var sentCount = 0
            connections.forEach { (userId, info) ->
                if (userId != excludeUserId) {
                    GlobalScope.launch {
                        try {
                            info.session.send(Frame.Text(message))
                            sentCount++
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to send to $userId: ${e.message}")
                        }
                    }
                }
            }

            promise.resolve(Arguments.createMap().apply {
                putBoolean("success", true)
                putInt("sentCount", sentCount)
            })

        } catch (e: Exception) {
            promise.reject("BROADCAST_ERROR", "Failed to broadcast: ${e.message}")
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RCTEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RCTEventEmitter
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun getConnectedClientsJson(): org.json.JSONArray {
        val clientsArray = org.json.JSONArray()
        connections.forEach { (_, info) ->
            clientsArray.put(JSONObject().apply {
                put("id", info.userId)
                put("userId", info.userId)
                put("username", info.username)
                put("deviceId", info.deviceId)
                put("lastSeen", System.currentTimeMillis())
            })
        }
        return clientsArray
    }

    private fun broadcastClientsUpdate(excludeUserId: String?) {
        val clientsMessage = JSONObject().apply {
            put("type", "CLIENTS")
            put("payload", JSONObject().apply {
                put("clients", getConnectedClientsJson())
            })
            put("timestamp", System.currentTimeMillis())
        }

        connections.forEach { (userId, info) ->
            if (userId != excludeUserId) {
                GlobalScope.launch {
                    try {
                        info.session.send(Frame.Text(clientsMessage.toString()))
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to send CLIENTS to $userId: ${e.message}")
                    }
                }
            }
        }
    }
}