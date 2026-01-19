#!/usr/bin/env python3
"""
Comprehensive Backend Tests for Nearu Chat Application
Tests REST API endpoints and WebSocket functionality
"""

import asyncio
import json
import requests
import websockets
import uuid
from datetime import datetime
from typing import Dict, List
import time

# Configuration
BACKEND_URL = "https://proxichat-84.preview.emergentagent.com"
WS_URL = "wss://proxichat-84.preview.emergentagent.com/api/ws"

class NearuTester:
    def __init__(self):
        self.test_results = []
        self.connected_clients = []
        
    def log_result(self, test_name: str, success: bool, message: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} {test_name}"
        if message:
            result += f" - {message}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message
        })
    
    def test_rest_api(self):
        """Test all REST API endpoints"""
        print("\n=== REST API TESTS ===")
        
        # Test 1: Health check endpoint
        try:
            response = requests.get(f"{BACKEND_URL}/api/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "version" in data:
                    self.log_result("GET /api/ (health check)", True, f"Response: {data}")
                else:
                    self.log_result("GET /api/ (health check)", False, f"Invalid response format: {data}")
            else:
                self.log_result("GET /api/ (health check)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("GET /api/ (health check)", False, f"Error: {str(e)}")
        
        # Test 2: Probe endpoint
        try:
            response = requests.get(f"{BACKEND_URL}/api/probe", timeout=10)
            if response.status_code == 200:
                data = response.json()
                expected_fields = ["service", "version", "wsPort", "timestamp"]
                if all(field in data for field in expected_fields):
                    self.log_result("GET /api/probe (discovery)", True, f"Service: {data.get('service')}, Version: {data.get('version')}")
                else:
                    self.log_result("GET /api/probe (discovery)", False, f"Missing fields in response: {data}")
            else:
                self.log_result("GET /api/probe (discovery)", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("GET /api/probe (discovery)", False, f"Error: {str(e)}")
        
        # Test 3: Get chats for user
        test_user_id = "test-user-123"
        try:
            response = requests.get(f"{BACKEND_URL}/api/chats?user_id={test_user_id}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "chats" in data and isinstance(data["chats"], list):
                    self.log_result("GET /api/chats", True, f"Found {len(data['chats'])} chats for user")
                else:
                    self.log_result("GET /api/chats", False, f"Invalid response format: {data}")
            else:
                self.log_result("GET /api/chats", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("GET /api/chats", False, f"Error: {str(e)}")
        
        # Test 4: Get messages for a chat
        test_chat_id = "test-chat-1"
        try:
            response = requests.get(f"{BACKEND_URL}/api/chats/{test_chat_id}/messages", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "messages" in data and isinstance(data["messages"], list):
                    self.log_result("GET /api/chats/{chat_id}/messages", True, f"Found {len(data['messages'])} messages")
                else:
                    self.log_result("GET /api/chats/{chat_id}/messages", False, f"Invalid response format: {data}")
            else:
                self.log_result("GET /api/chats/{chat_id}/messages", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("GET /api/chats/{chat_id}/messages", False, f"Error: {str(e)}")

    async def test_websocket_handshake(self):
        """Test WebSocket connection and handshake protocol"""
        print("\n=== WEBSOCKET HANDSHAKE TESTS ===")
        
        try:
            # Test successful handshake
            async with websockets.connect(WS_URL) as websocket:
                # Step 1: Receive CONFIG message
                config_msg = await asyncio.wait_for(websocket.recv(), timeout=5)
                config_data = json.loads(config_msg)
                
                if config_data.get("type") == "CONFIG":
                    self.log_result("WebSocket CONFIG received", True, f"Server version: {config_data.get('payload', {}).get('serverVersion')}")
                else:
                    self.log_result("WebSocket CONFIG received", False, f"Expected CONFIG, got: {config_data.get('type')}")
                    return
                
                # Step 2: Send HELLO message
                hello_msg = {
                    "type": "HELLO",
                    "payload": {
                        "userId": "test-user-ws-1",
                        "deviceId": "device-123",
                        "username": "TestUser1"
                    },
                    "timestamp": datetime.now().timestamp()
                }
                await websocket.send(json.dumps(hello_msg))
                
                # Step 3: Receive HELLO_ACK
                hello_ack_msg = await asyncio.wait_for(websocket.recv(), timeout=5)
                hello_ack_data = json.loads(hello_ack_msg)
                
                if hello_ack_data.get("type") == "HELLO_ACK":
                    payload = hello_ack_data.get("payload", {})
                    if payload.get("status") == "connected":
                        self.log_result("WebSocket HELLO_ACK received", True, f"Connected as: {payload.get('userId')}")
                    else:
                        self.log_result("WebSocket HELLO_ACK received", False, f"Status not connected: {payload.get('status')}")
                else:
                    self.log_result("WebSocket HELLO_ACK received", False, f"Expected HELLO_ACK, got: {hello_ack_data.get('type')}")
                
        except Exception as e:
            self.log_result("WebSocket handshake", False, f"Error: {str(e)}")

    async def test_websocket_messaging(self):
        """Test WebSocket message sending and receiving"""
        print("\n=== WEBSOCKET MESSAGING TESTS ===")
        
        try:
            # Connect first client
            async with websockets.connect(WS_URL) as ws1:
                # Complete handshake for client 1
                await ws1.recv()  # CONFIG
                hello1 = {
                    "type": "HELLO",
                    "payload": {
                        "userId": "user-msg-1",
                        "deviceId": "device-msg-1",
                        "username": "MsgUser1"
                    },
                    "timestamp": datetime.now().timestamp()
                }
                await ws1.send(json.dumps(hello1))
                await ws1.recv()  # HELLO_ACK
                
                # Test REQUEST_CLIENTS
                request_clients_msg = {
                    "type": "REQUEST_CLIENTS",
                    "payload": {},
                    "timestamp": datetime.now().timestamp()
                }
                await ws1.send(json.dumps(request_clients_msg))
                
                clients_response = await asyncio.wait_for(ws1.recv(), timeout=5)
                clients_data = json.loads(clients_response)
                
                if clients_data.get("type") == "CLIENTS":
                    clients = clients_data.get("payload", {}).get("clients", [])
                    self.log_result("REQUEST_CLIENTS", True, f"Found {len(clients)} connected clients")
                else:
                    self.log_result("REQUEST_CLIENTS", False, f"Expected CLIENTS response, got: {clients_data.get('type')}")
                
                # Test sending a MESSAGE
                chat_id = f"user-msg-1-user-msg-2"
                message_msg = {
                    "type": "MESSAGE",
                    "payload": {
                        "id": str(uuid.uuid4()),
                        "chatId": chat_id,
                        "senderId": "user-msg-1",
                        "content": "Hello from WebSocket test!",
                        "timestamp": datetime.now().timestamp(),
                        "participants": ["user-msg-1", "user-msg-2"]
                    },
                    "timestamp": datetime.now().timestamp()
                }
                await ws1.send(json.dumps(message_msg))
                self.log_result("Send MESSAGE via WebSocket", True, "Message sent successfully")
                
        except Exception as e:
            self.log_result("WebSocket messaging", False, f"Error: {str(e)}")

    async def test_multi_client_websocket(self):
        """Test multiple WebSocket clients simultaneously"""
        print("\n=== MULTI-CLIENT WEBSOCKET TESTS ===")
        
        try:
            # Connect two clients simultaneously
            ws1 = await websockets.connect(WS_URL)
            ws2 = await websockets.connect(WS_URL)
            
            try:
                # Handshake for client 1
                await ws1.recv()  # CONFIG
                hello1 = {
                    "type": "HELLO",
                    "payload": {
                        "userId": "multi-user-1",
                        "deviceId": "multi-device-1",
                        "username": "MultiUser1"
                    },
                    "timestamp": datetime.now().timestamp()
                }
                await ws1.send(json.dumps(hello1))
                await ws1.recv()  # HELLO_ACK
                
                # Handshake for client 2
                await ws2.recv()  # CONFIG
                hello2 = {
                    "type": "HELLO",
                    "payload": {
                        "userId": "multi-user-2",
                        "deviceId": "multi-device-2",
                        "username": "MultiUser2"
                    },
                    "timestamp": datetime.now().timestamp()
                }
                await ws2.send(json.dumps(hello2))
                await ws2.recv()  # HELLO_ACK
                
                # Client 2 should receive CLIENTS update when client 1 connected
                try:
                    clients_update = await asyncio.wait_for(ws2.recv(), timeout=3)
                    clients_data = json.loads(clients_update)
                    if clients_data.get("type") == "CLIENTS":
                        self.log_result("Multi-client CLIENTS broadcast", True, "Client 2 received clients update")
                    else:
                        self.log_result("Multi-client CLIENTS broadcast", False, f"Expected CLIENTS, got: {clients_data.get('type')}")
                except asyncio.TimeoutError:
                    self.log_result("Multi-client CLIENTS broadcast", False, "No clients update received")
                
                # Test message broadcast between clients
                chat_id = "multi-user-1-multi-user-2"
                message_msg = {
                    "type": "MESSAGE",
                    "payload": {
                        "id": str(uuid.uuid4()),
                        "chatId": chat_id,
                        "senderId": "multi-user-1",
                        "content": "Hello from client 1 to client 2!",
                        "timestamp": datetime.now().timestamp(),
                        "participants": ["multi-user-1", "multi-user-2"]
                    },
                    "timestamp": datetime.now().timestamp()
                }
                
                # Send from client 1
                await ws1.send(json.dumps(message_msg))
                
                # Client 2 should receive the message
                try:
                    received_msg = await asyncio.wait_for(ws2.recv(), timeout=5)
                    received_data = json.loads(received_msg)
                    if received_data.get("type") == "MESSAGE":
                        content = received_data.get("payload", {}).get("content")
                        self.log_result("Multi-client message broadcast", True, f"Message received: {content}")
                    else:
                        self.log_result("Multi-client message broadcast", False, f"Expected MESSAGE, got: {received_data.get('type')}")
                except asyncio.TimeoutError:
                    self.log_result("Multi-client message broadcast", False, "Message not received by client 2")
                
            finally:
                await ws1.close()
                await ws2.close()
                
        except Exception as e:
            self.log_result("Multi-client WebSocket", False, f"Error: {str(e)}")

    async def test_websocket_edge_cases(self):
        """Test WebSocket edge cases and error handling"""
        print("\n=== WEBSOCKET EDGE CASES ===")
        
        # Test 1: Connection without HELLO (should be rejected)
        try:
            async with websockets.connect(WS_URL) as websocket:
                await websocket.recv()  # CONFIG
                
                # Send invalid message instead of HELLO
                invalid_msg = {
                    "type": "MESSAGE",
                    "payload": {"content": "Invalid first message"},
                    "timestamp": datetime.now().timestamp()
                }
                await websocket.send(json.dumps(invalid_msg))
                
                # Connection should be closed
                try:
                    await asyncio.wait_for(websocket.recv(), timeout=3)
                    self.log_result("Connection without HELLO rejection", False, "Connection not rejected")
                except websockets.exceptions.ConnectionClosed as e:
                    if e.code == 1008:
                        self.log_result("Connection without HELLO rejection", True, f"Connection properly rejected: {e.reason}")
                    else:
                        self.log_result("Connection without HELLO rejection", False, f"Wrong close code: {e.code}")
                except asyncio.TimeoutError:
                    self.log_result("Connection without HELLO rejection", False, "Connection not closed")
                    
        except Exception as e:
            self.log_result("Connection without HELLO rejection", False, f"Error: {str(e)}")
        
        # Test 2: HELLO with missing fields
        try:
            async with websockets.connect(WS_URL) as websocket:
                await websocket.recv()  # CONFIG
                
                # Send HELLO without required fields
                invalid_hello = {
                    "type": "HELLO",
                    "payload": {
                        "username": "TestUser"
                        # Missing userId and deviceId
                    },
                    "timestamp": datetime.now().timestamp()
                }
                await websocket.send(json.dumps(invalid_hello))
                
                # Connection should be closed
                try:
                    await asyncio.wait_for(websocket.recv(), timeout=3)
                    self.log_result("Malformed HELLO rejection", False, "Connection not rejected")
                except websockets.exceptions.ConnectionClosed as e:
                    if e.code == 1008:
                        self.log_result("Malformed HELLO rejection", True, f"Connection properly rejected: {e.reason}")
                    else:
                        self.log_result("Malformed HELLO rejection", False, f"Wrong close code: {e.code}")
                except asyncio.TimeoutError:
                    self.log_result("Malformed HELLO rejection", False, "Connection not closed")
                    
        except Exception as e:
            self.log_result("Malformed HELLO rejection", False, f"Error: {str(e)}")

    async def test_websocket_reconnection(self):
        """Test reconnection with same user"""
        print("\n=== WEBSOCKET RECONNECTION TESTS ===")
        
        user_id = "reconnect-user-1"
        device_id = "reconnect-device-1"
        username = "ReconnectUser"
        
        try:
            # First connection
            async with websockets.connect(WS_URL) as ws1:
                await ws1.recv()  # CONFIG
                hello1 = {
                    "type": "HELLO",
                    "payload": {
                        "userId": user_id,
                        "deviceId": device_id,
                        "username": username
                    },
                    "timestamp": datetime.now().timestamp()
                }
                await ws1.send(json.dumps(hello1))
                await ws1.recv()  # HELLO_ACK
                
                self.log_result("First connection established", True, f"User {user_id} connected")
            
            # Wait a moment
            await asyncio.sleep(1)
            
            # Reconnection with same user
            async with websockets.connect(WS_URL) as ws2:
                await ws2.recv()  # CONFIG
                hello2 = {
                    "type": "HELLO",
                    "payload": {
                        "userId": user_id,
                        "deviceId": device_id,
                        "username": username
                    },
                    "timestamp": datetime.now().timestamp()
                }
                await ws2.send(json.dumps(hello2))
                hello_ack = await ws2.recv()  # HELLO_ACK
                
                hello_ack_data = json.loads(hello_ack)
                if hello_ack_data.get("type") == "HELLO_ACK":
                    self.log_result("Reconnection with same user", True, f"User {user_id} reconnected successfully")
                else:
                    self.log_result("Reconnection with same user", False, f"Expected HELLO_ACK, got: {hello_ack_data.get('type')}")
                    
        except Exception as e:
            self.log_result("Reconnection test", False, f"Error: {str(e)}")

    async def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Nearu Backend Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"WebSocket URL: {WS_URL}")
        
        # REST API Tests
        self.test_rest_api()
        
        # WebSocket Tests
        await self.test_websocket_handshake()
        await self.test_websocket_messaging()
        await self.test_multi_client_websocket()
        await self.test_websocket_edge_cases()
        await self.test_websocket_reconnection()
        
        # Summary
        print("\n" + "="*50)
        print("TEST SUMMARY")
        print("="*50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        
        if total - passed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']}: {result['message']}")
        
        print(f"\nOverall Result: {'✅ ALL TESTS PASSED' if passed == total else '❌ SOME TESTS FAILED'}")
        
        return passed == total

async def main():
    """Main test runner"""
    tester = NearuTester()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    asyncio.run(main())