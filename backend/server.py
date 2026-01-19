from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Set
import uuid
from datetime import datetime
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ============================================================================
# MODELS & ENUMS
# ============================================================================

class MessageType(str, Enum):
    CONFIG = "CONFIG"
    HELLO = "HELLO"
    HELLO_ACK = "HELLO_ACK"
    MESSAGE = "MESSAGE"
    CLIENTS = "CLIENTS"
    REQUEST_CLIENTS = "REQUEST_CLIENTS"
    SYSTEM = "SYSTEM"


class WireEnvelope(BaseModel):
    type: MessageType
    payload: dict
    timestamp: float = Field(default_factory=lambda: datetime.now().timestamp())


class User(BaseModel):
    id: str
    deviceId: str
    username: str
    lastSeen: float


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chatId: str
    senderId: str
    content: str
    timestamp: float = Field(default_factory=lambda: datetime.now().timestamp())
    status: str = "delivered"  # sending, delivered, failed


class Chat(BaseModel):
    id: str
    type: str  # 'direct' or 'group'
    participants: List[str]
    lastMessage: Optional[str] = None
    updatedAt: float = Field(default_factory=lambda: datetime.now().timestamp())


# ============================================================================
# WEBSOCKET CONNECTION MANAGER
# ============================================================================

class ConnectionManager:
    def __init__(self):
        # Store active connections: {userId: {"ws": WebSocket, "deviceId": str, "username": str}}
        self.active_connections: Dict[str, Dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, device_id: str, username: str):
        await websocket.accept()
        self.active_connections[user_id] = {
            "ws": websocket,
            "deviceId": device_id,
            "username": username
        }
        logger.info(f"Client connected: {user_id} ({username})")
        
        # Send CONFIG message
        config_message = WireEnvelope(
            type=MessageType.CONFIG,
            payload={
                "serverVersion": "1.0.0",
                "protocolVersion": "1.0"
            }
        )
        await websocket.send_text(config_message.model_dump_json())

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"Client disconnected: {user_id}")

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id]["ws"].send_text(message)

    async def broadcast(self, message: str, exclude_user_id: Optional[str] = None):
        for user_id, connection in self.active_connections.items():
            if user_id != exclude_user_id:
                try:
                    await connection["ws"].send_text(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to {user_id}: {e}")

    def get_connected_clients(self) -> List[Dict]:
        return [
            {
                "id": user_id,
                "deviceId": conn["deviceId"],
                "username": conn["username"],
                "lastSeen": datetime.now().timestamp()
            }
            for user_id, conn in self.active_connections.items()
        ]


manager = ConnectionManager()


# ============================================================================
# WEBSOCKET ENDPOINT
# ============================================================================

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = None
    device_id = None
    username = None
    
    try:
        await websocket.accept()
        
        # Send CONFIG
        config_message = WireEnvelope(
            type=MessageType.CONFIG,
            payload={
                "serverVersion": "1.0.0",
                "protocolVersion": "1.0"
            }
        )
        await websocket.send_text(config_message.model_dump_json())
        
        # Wait for HELLO from client
        data = await websocket.receive_text()
        hello_envelope = WireEnvelope.model_validate_json(data)
        
        if hello_envelope.type != MessageType.HELLO:
            await websocket.close(code=1008, reason="Expected HELLO message")
            return
        
        # Extract user info from HELLO
        user_id = hello_envelope.payload.get("userId")
        device_id = hello_envelope.payload.get("deviceId")
        username = hello_envelope.payload.get("username", "Anonymous")
        
        if not user_id or not device_id:
            await websocket.close(code=1008, reason="Missing userId or deviceId")
            return
        
        # Register connection
        manager.active_connections[user_id] = {
            "ws": websocket,
            "deviceId": device_id,
            "username": username
        }
        logger.info(f"Client connected: {user_id} ({username})")
        
        # Send HELLO_ACK
        hello_ack = WireEnvelope(
            type=MessageType.HELLO_ACK,
            payload={
                "userId": user_id,
                "status": "connected",
                "connectedClients": manager.get_connected_clients()
            }
        )
        await websocket.send_text(hello_ack.model_dump_json())
        
        # Notify other clients about new connection
        await manager.broadcast(
            WireEnvelope(
                type=MessageType.CLIENTS,
                payload={"clients": manager.get_connected_clients()}
            ).model_dump_json(),
            exclude_user_id=user_id
        )
        
        # Main message loop
        while True:
            data = await websocket.receive_text()
            envelope = WireEnvelope.model_validate_json(data)
            
            if envelope.type == MessageType.MESSAGE:
                # Handle chat message
                message_data = envelope.payload
                
                # Save to database
                message = Message(**message_data)
                await db.messages.insert_one(message.model_dump())
                
                # Update chat
                chat_id = message.chatId
                chat_doc = await db.chats.find_one({"id": chat_id})
                
                if chat_doc:
                    await db.chats.update_one(
                        {"id": chat_id},
                        {
                            "$set": {
                                "lastMessage": message.content,
                                "updatedAt": message.timestamp
                            }
                        }
                    )
                else:
                    # Create new chat
                    participants = message_data.get("participants", [])
                    if not participants:
                        # Extract from chatId (format: userId1-userId2)
                        participants = chat_id.split("-")
                    
                    chat = Chat(
                        id=chat_id,
                        type="direct",
                        participants=participants,
                        lastMessage=message.content,
                        updatedAt=message.timestamp
                    )
                    await db.chats.insert_one(chat.model_dump())
                
                # Broadcast to participants
                participants = message_data.get("participants", [])
                for participant_id in participants:
                    if participant_id != user_id:
                        await manager.send_personal_message(
                            envelope.model_dump_json(),
                            participant_id
                        )
            
            elif envelope.type == MessageType.REQUEST_CLIENTS:
                # Send list of connected clients
                clients_message = WireEnvelope(
                    type=MessageType.CLIENTS,
                    payload={"clients": manager.get_connected_clients()}
                )
                await websocket.send_text(clients_message.model_dump_json())
            
            elif envelope.type == MessageType.SYSTEM:
                # Handle system messages (future use)
                logger.info(f"System message from {user_id}: {envelope.payload}")
    
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {user_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
    finally:
        if user_id:
            manager.disconnect(user_id)
            # Notify others about disconnection
            await manager.broadcast(
                WireEnvelope(
                    type=MessageType.CLIENTS,
                    payload={"clients": manager.get_connected_clients()}
                ).model_dump_json()
            )


# ============================================================================
# REST API ENDPOINTS
# ============================================================================

@api_router.get("/")
async def root():
    return {"message": "Nearu API", "version": "1.0.0"}


@api_router.get("/chats")
async def get_chats(user_id: str):
    """Get all chats for a user"""
    chats = await db.chats.find(
        {"participants": user_id}
    ).sort("updatedAt", -1).to_list(100)
    
    # Convert MongoDB documents to JSON-serializable format
    for chat in chats:
        if "_id" in chat:
            chat["_id"] = str(chat["_id"])
    
    return {"chats": chats}


@api_router.get("/chats/{chat_id}/messages")
async def get_messages(chat_id: str, limit: int = 50):
    """Get messages for a chat"""
    messages = await db.messages.find(
        {"chatId": chat_id}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Reverse to show oldest first
    messages.reverse()
    
    # Convert MongoDB documents to JSON-serializable format
    for message in messages:
        if "_id" in message:
            message["_id"] = str(message["_id"])
    
    return {"messages": messages}


@api_router.get("/probe")
async def probe():
    """Probe endpoint for discovery (used by web clients)"""
    return {
        "service": "nearu",
        "version": "1.0.0",
        "wsPort": 8001,
        "timestamp": datetime.now().timestamp()
    }


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
