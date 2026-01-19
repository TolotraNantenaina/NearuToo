#!/usr/bin/env python3
"""
Test data persistence - send messages via WebSocket and retrieve via REST API
"""

import asyncio
import json
import websockets
import requests
import uuid
from datetime import datetime

BACKEND_URL = "https://proxichat-84.preview.emergentagent.com"
WS_URL = "wss://proxichat-84.preview.emergentagent.com/api/ws"

async def test_data_persistence():
    """Test that messages sent via WebSocket are persisted and retrievable via REST API"""
    print("🔍 Testing data persistence...")
    
    # Test data
    user1_id = "persist-user-1"
    user2_id = "persist-user-2"
    chat_id = f"{user1_id}-{user2_id}"
    test_message = f"Persistence test message {datetime.now().timestamp()}"
    
    # Connect and send a message via WebSocket
    async with websockets.connect(WS_URL) as websocket:
        # Complete handshake
        await websocket.recv()  # CONFIG
        
        hello = {
            "type": "HELLO",
            "payload": {
                "userId": user1_id,
                "deviceId": "persist-device-1",
                "username": "PersistUser1"
            },
            "timestamp": datetime.now().timestamp()
        }
        await websocket.send(json.dumps(hello))
        await websocket.recv()  # HELLO_ACK
        
        # Send a message
        message_msg = {
            "type": "MESSAGE",
            "payload": {
                "id": str(uuid.uuid4()),
                "chatId": chat_id,
                "senderId": user1_id,
                "content": test_message,
                "timestamp": datetime.now().timestamp(),
                "participants": [user1_id, user2_id]
            },
            "timestamp": datetime.now().timestamp()
        }
        
        await websocket.send(json.dumps(message_msg))
        print(f"📤 Sent message via WebSocket: '{test_message}'")
    
    # Wait a moment for persistence
    await asyncio.sleep(1)
    
    # Retrieve messages via REST API
    try:
        response = requests.get(f"{BACKEND_URL}/api/chats/{chat_id}/messages", timeout=10)
        if response.status_code == 200:
            data = response.json()
            messages = data.get("messages", [])
            
            # Check if our message is there
            found_message = None
            for msg in messages:
                if msg.get("content") == test_message:
                    found_message = msg
                    break
            
            if found_message:
                print(f"✅ Message persisted and retrieved successfully!")
                print(f"   Content: {found_message['content']}")
                print(f"   Sender: {found_message['senderId']}")
                print(f"   Chat ID: {found_message['chatId']}")
                return True
            else:
                print(f"❌ Message not found in retrieved messages")
                print(f"   Retrieved {len(messages)} messages")
                return False
        else:
            print(f"❌ Failed to retrieve messages: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error retrieving messages: {str(e)}")
        return False

async def test_chat_creation():
    """Test that chats are created when messages are sent"""
    print("\n🔍 Testing chat creation...")
    
    user1_id = "chat-create-user-1"
    user2_id = "chat-create-user-2"
    chat_id = f"{user1_id}-{user2_id}"
    
    # Send a message to create a chat
    async with websockets.connect(WS_URL) as websocket:
        await websocket.recv()  # CONFIG
        
        hello = {
            "type": "HELLO",
            "payload": {
                "userId": user1_id,
                "deviceId": "chat-create-device-1",
                "username": "ChatCreateUser1"
            },
            "timestamp": datetime.now().timestamp()
        }
        await websocket.send(json.dumps(hello))
        await websocket.recv()  # HELLO_ACK
        
        message_msg = {
            "type": "MESSAGE",
            "payload": {
                "id": str(uuid.uuid4()),
                "chatId": chat_id,
                "senderId": user1_id,
                "content": "First message to create chat",
                "timestamp": datetime.now().timestamp(),
                "participants": [user1_id, user2_id]
            },
            "timestamp": datetime.now().timestamp()
        }
        
        await websocket.send(json.dumps(message_msg))
        print(f"📤 Sent message to create chat: {chat_id}")
    
    # Wait for persistence
    await asyncio.sleep(1)
    
    # Check if chat appears in user's chat list
    try:
        response = requests.get(f"{BACKEND_URL}/api/chats?user_id={user1_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            chats = data.get("chats", [])
            
            # Look for our chat
            found_chat = None
            for chat in chats:
                if chat.get("id") == chat_id:
                    found_chat = chat
                    break
            
            if found_chat:
                print(f"✅ Chat created successfully!")
                print(f"   Chat ID: {found_chat['id']}")
                print(f"   Type: {found_chat['type']}")
                print(f"   Participants: {found_chat['participants']}")
                print(f"   Last Message: {found_chat.get('lastMessage', 'None')}")
                return True
            else:
                print(f"❌ Chat not found in user's chat list")
                print(f"   Found {len(chats)} chats for user")
                return False
        else:
            print(f"❌ Failed to retrieve chats: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error retrieving chats: {str(e)}")
        return False

async def main():
    """Run persistence tests"""
    print("🚀 Starting Data Persistence Tests")
    
    persistence_ok = await test_data_persistence()
    chat_creation_ok = await test_chat_creation()
    
    print(f"\n📊 Results:")
    print(f"   Message Persistence: {'✅ PASS' if persistence_ok else '❌ FAIL'}")
    print(f"   Chat Creation: {'✅ PASS' if chat_creation_ok else '❌ FAIL'}")
    
    if persistence_ok and chat_creation_ok:
        print("🎉 All persistence tests passed!")
        return True
    else:
        print("❌ Some persistence tests failed!")
        return False

if __name__ == "__main__":
    asyncio.run(main())