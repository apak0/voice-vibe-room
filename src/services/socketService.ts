import { io, Socket } from 'socket.io-client';

interface Participant {
  userId: string;
  userName: string;
  isMuted: boolean;
  timestamp: number;
}

interface SignalData {
  roomId: string;
  signal: any;
  fromUserId: string;
  targetUserId: string;
  timestamp: number;
}

class SocketService {
  private socket: Socket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private static instance: SocketService;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect(): Socket {
    if (!this.socket) {
      console.log('No real server available, using local fallback mode');
      this.initializeBroadcastChannel();
      
      // Create a dummy socket object for compatibility
      this.socket = {
        connected: false,
        emit: () => {},
        on: () => {},
        disconnect: () => {}
      } as any;
    }
    
    return this.socket;
  }

  private initializeBroadcastChannel() {
    if (!this.broadcastChannel) {
      this.broadcastChannel = new BroadcastChannel('voice-chat-signaling');
      
      this.broadcastChannel.onmessage = (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'user-joined':
            console.log('BroadcastChannel: user-joined received', data);
            if (data.roomId === this.currentRoomId || !data.roomId) {
              this.emit('user-joined', data);
            }
            break;
          case 'user-left':
            console.log('BroadcastChannel: user-left received', data);
            this.emit('user-left', data);
            break;
          case 'signal':
            if (data.targetUserId === this.currentUserId) {
              this.emit('signal', { signal: data.signal, fromUserId: data.fromUserId });
            }
            break;
          case 'room-participants':
            console.log('BroadcastChannel: room-participants received', data);
            if (data.roomId === this.currentRoomId) {
              this.emit('room-participants', data.participants);
            }
            break;
          case 'user-mute-status':
            this.emit('user-mute-status', data);
            break;
        }
      };
    }
  }

  private emit(eventName: string, data: any) {
    const handlers = this.eventHandlers.get(eventName) || [];
    handlers.forEach(handler => handler(data));
  }

  private on(eventName: string, handler: Function) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName)!.push(handler);
  }

  joinRoom(roomId: string, userId: string, userName: string) {
    console.log(`Joining room: ${roomId} as ${userName} (${userId})`);
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    this.currentUserName = userName;

    // Always use local storage fallback since no server
    this.initializeBroadcastChannel();
    
    // Store participant in localStorage
    const participantsKey = `room_${roomId}_participants`;
    const participants = JSON.parse(localStorage.getItem(participantsKey) || '[]') as Participant[];
    
    // Remove existing entry for this user
    const filteredParticipants = participants.filter(p => p.userId !== userId);
    
    // Add current user
    const newParticipant: Participant = {
      userId,
      userName,
      isMuted: false,
      timestamp: Date.now()
    };
    filteredParticipants.push(newParticipant);
    
    console.log(`Storing participants:`, filteredParticipants);
    localStorage.setItem(participantsKey, JSON.stringify(filteredParticipants));
    
    // Broadcast to other tabs immediately
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'user-joined',
        data: { userId, userName, roomId }
      });
      
      // Send current participants to this user and others
      this.broadcastChannel.postMessage({
        type: 'room-participants',
        data: { roomId, participants: filteredParticipants }
      });
    }
    
    // Emit locally as well for immediate update
    setTimeout(() => {
      this.emit('room-participants', filteredParticipants);
    }, 50);
  }

  leaveRoom(roomId: string, userId: string) {
    if (this.socket?.connected) {
      this.socket.emit('leave-room', { roomId, userId });
    } else {
      // Remove from localStorage
      const participantsKey = `room_${roomId}_participants`;
      const participants = JSON.parse(localStorage.getItem(participantsKey) || '[]') as Participant[];
      const filteredParticipants = participants.filter(p => p.userId !== userId);
      localStorage.setItem(participantsKey, JSON.stringify(filteredParticipants));
      
      // Broadcast to other tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'user-left',
          data: userId
        });
      }
    }

    this.currentRoomId = null;
    this.currentUserId = null;
    this.currentUserName = null;
  }

  sendSignal(roomId: string, signal: any, targetUserId: string) {
    if (this.socket?.connected) {
      this.socket.emit('signal', { roomId, signal, targetUserId });
    } else {
      // Use BroadcastChannel for local signaling
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'signal',
          data: {
            roomId,
            signal,
            fromUserId: this.currentUserId,
            targetUserId,
            timestamp: Date.now()
          }
        });
      }
    }
  }

  sendMuteStatus(roomId: string, isMuted: boolean) {
    if (this.socket?.connected) {
      this.socket.emit('mute-status', { roomId, isMuted });
    } else {
      // Update localStorage
      const participantsKey = `room_${roomId}_participants`;
      const participants = JSON.parse(localStorage.getItem(participantsKey) || '[]') as Participant[];
      const updatedParticipants = participants.map(p => 
        p.userId === this.currentUserId ? { ...p, isMuted } : p
      );
      localStorage.setItem(participantsKey, JSON.stringify(updatedParticipants));
      
      // Broadcast to other tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'user-mute-status',
          data: { userId: this.currentUserId, isMuted }
        });
      }
    }
  }

  onUserJoined(callback: (data: { userId: string; userName: string }) => void) {
    this.on('user-joined', callback);
  }

  onUserLeft(callback: (userId: string) => void) {
    this.on('user-left', callback);
  }

  onSignal(callback: (data: { signal: any; fromUserId: string }) => void) {
    this.on('signal', callback);
  }

  onRoomParticipants(callback: (participants: { userId: string; userName: string }[]) => void) {
    this.on('room-participants', callback);
  }

  onUserMuteStatus(callback: (data: { userId: string; isMuted: boolean }) => void) {
    this.on('user-mute-status', callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.eventHandlers.clear();
  }
}

export const socketService = SocketService.getInstance();