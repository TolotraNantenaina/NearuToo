#!/usr/bin/env python3
"""
Focused test for multi-client WebSocket functionality
"""

import asyncio
import json
import websockets
from datetime import datetime

WS_URL = "wss://proxichat-84.preview.emergentagent.com/api/ws"

async def test_multi_client_detailed():
    """Detailed test of multi-client functionality"""
    print("🔍 Testing multi-client WebSocket functionality in detail...")
    
    # Connect first client
    ws1 = await websockets.connect(WS_URL)
    print("✅ Client 1 connected")
    
    # Complete handshake for client 1
    config1 = await ws1.recv()
    print(f"📨 Client 1 received CONFIG: {json.loads(config1)['type']}")
    
    hello1 = {
        "type": "HELLO",
        "payload": {
            "userId": "detailed-user-1",
            "deviceId": "detailed-device-1", 
            "username": "DetailedUser1"
        },
        "timestamp": datetime.now().timestamp()
    }
    await ws1.send(json.dumps(hello1))
    
    hello_ack1 = await ws1.recv()
    hello_ack1_data = json.loads(hello_ack1)
    print(f"📨 Client 1 received HELLO_ACK: {hello_ack1_data['payload']['status']}")
    
    # Now connect second client
    ws2 = await websockets.connect(WS_URL)
    print("✅ Client 2 connected")
    
    # Complete handshake for client 2
    config2 = await ws2.recv()
    print(f"📨 Client 2 received CONFIG: {json.loads(config2)['type']}")
    
    hello2 = {
        "type": "HELLO",
        "payload": {
            "userId": "detailed-user-2",
            "deviceId": "detailed-device-2",
            "username": "DetailedUser2"
        },
        "timestamp": datetime.now().timestamp()
    }
    await ws2.send(json.dumps(hello2))
    
    hello_ack2 = await ws2.recv()
    hello_ack2_data = json.loads(hello_ack2)
    print(f"📨 Client 2 received HELLO_ACK: {hello_ack2_data['payload']['status']}")
    
    # Check if client 1 receives CLIENTS broadcast when client 2 connects
    print("🔍 Checking if Client 1 receives CLIENTS broadcast...")
    try:
        clients_msg = await asyncio.wait_for(ws1.recv(), timeout=5)
        clients_data = json.loads(clients_msg)
        if clients_data.get("type") == "CLIENTS":
            clients = clients_data.get("payload", {}).get("clients", [])
            print(f"✅ Client 1 received CLIENTS broadcast with {len(clients)} clients")
            for client in clients:
                print(f"   - {client['username']} ({client['id']})")
        else:
            print(f"❌ Client 1 received unexpected message: {clients_data.get('type')}")
    except asyncio.TimeoutError:
        print("❌ Client 1 did not receive CLIENTS broadcast within timeout")
    
    # Test message exchange
    print("\n🔍 Testing message exchange between clients...")
    
    chat_id = "detailed-user-1-detailed-user-2"
    message_msg = {
        "type": "MESSAGE",
        "payload": {
            "id": "test-msg-123",
            "chatId": chat_id,
            "senderId": "detailed-user-1",
            "content": "Hello from detailed test!",
            "timestamp": datetime.now().timestamp(),
            "participants": ["detailed-user-1", "detailed-user-2"]
        },
        "timestamp": datetime.now().timestamp()
    }
    
    # Send from client 1
    await ws1.send(json.dumps(message_msg))
    print("📤 Client 1 sent message")
    
    # Check if client 2 receives it
    try:
        received_msg = await asyncio.wait_for(ws2.recv(), timeout=5)
        received_data = json.loads(received_msg)
        if received_data.get("type") == "MESSAGE":
            content = received_data.get("payload", {}).get("content")
            print(f"✅ Client 2 received message: '{content}'")
        else:
            print(f"❌ Client 2 received unexpected message: {received_data.get('type')}")
    except asyncio.TimeoutError:
        print("❌ Client 2 did not receive message within timeout")
    
    # Clean up
    await ws1.close()
    await ws2.close()
    print("🧹 Connections closed")

if __name__ == "__main__":
    asyncio.run(test_multi_client_detailed())