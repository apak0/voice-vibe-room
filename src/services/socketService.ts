import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private static instance: SocketService;

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect(): Socket {
    if (!this.socket) {
      // For development, we'll use a mock signaling server
      // In production, you'd connect to your actual socket server
      this.socket = io('ws://localhost:3001', {
        transports: ['websocket'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('Connected to signaling server');
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
      });

      this.socket.on('connect_error', (error) => {
        console.warn('Socket connection failed, using local fallback:', error);
        // Fallback to local-only mode for demo purposes
      });
    }
    
    return this.socket;
  }

  joinRoom(roomId: string, userId: string, userName: string) {
    if (this.socket) {
      this.socket.emit('join-room', { roomId, userId, userName });
    }
  }

  leaveRoom(roomId: string, userId: string) {
    if (this.socket) {
      this.socket.emit('leave-room', { roomId, userId });
    }
  }

  sendSignal(roomId: string, signal: any, targetUserId: string) {
    if (this.socket) {
      this.socket.emit('signal', { roomId, signal, targetUserId });
    }
  }

  onUserJoined(callback: (data: { userId: string; userName: string }) => void) {
    if (this.socket) {
      this.socket.on('user-joined', callback);
    }
  }

  onUserLeft(callback: (userId: string) => void) {
    if (this.socket) {
      this.socket.on('user-left', callback);
    }
  }

  onSignal(callback: (data: { signal: any; fromUserId: string }) => void) {
    if (this.socket) {
      this.socket.on('signal', callback);
    }
  }

  onRoomParticipants(callback: (participants: { userId: string; userName: string }[]) => void) {
    if (this.socket) {
      this.socket.on('room-participants', callback);
    }
  }

  onUserMuteStatus(callback: (data: { userId: string; isMuted: boolean }) => void) {
    if (this.socket) {
      this.socket.on('user-mute-status', callback);
    }
  }

  sendMuteStatus(roomId: string, isMuted: boolean) {
    if (this.socket) {
      this.socket.emit('mute-status', { roomId, isMuted });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = SocketService.getInstance();