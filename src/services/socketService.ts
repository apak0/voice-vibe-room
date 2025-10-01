import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  private channel: RealtimeChannel | null = null;
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

  connect() {
    console.log('Using Supabase Realtime for real-time communication');
    return { channel: this.channel };
  }

  private async setupChannel(roomId: string): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
    }

    return new Promise((resolve) => {
      this.channel = supabase.channel(`room:${roomId}`)
        .on('broadcast', { event: 'user-joined' }, (payload) => {
          console.log('Supabase: user-joined received', payload);
          this.emit('user-joined', payload.payload);
        })
        .on('broadcast', { event: 'user-left' }, (payload) => {
          console.log('Supabase: user-left received', payload);
          this.emit('user-left', payload.payload.userId);
        })
        .on('broadcast', { event: 'signal' }, (payload) => {
          const data = payload.payload;
          if (data.targetUserId === this.currentUserId) {
            this.emit('signal', { signal: data.signal, fromUserId: data.fromUserId });
          }
        })
        .on('broadcast', { event: 'room-participants' }, (payload) => {
          console.log('Supabase: room-participants received', payload);
          this.emit('room-participants', payload.payload.participants);
        })
        .on('broadcast', { event: 'user-mute-status' }, (payload) => {
          this.emit('user-mute-status', payload.payload);
        })
        .on('broadcast', { event: 'user-speaking-status' }, (payload) => {
          this.emit('user-speaking-status', payload.payload);
        })
        .on('broadcast', { event: 'user-video-status' }, (payload) => {
          this.emit('user-video-status', payload.payload);
        })
        .on('presence', { event: 'sync' }, () => {
          console.log('Presence sync event');
          const state = this.channel?.presenceState();
          console.log('Current presence state:', state);
          if (state) {
            const participants = Object.keys(state).map(key => {
              const presences = state[key] as any[];
              const presence = presences[0];
              return {
                userId: presence.userId,
                userName: presence.userName,
                isMuted: presence.isMuted || false
              };
            });
            console.log('Participants from presence:', participants);
            this.emit('room-participants', participants);
          }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('Presence join event:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('Presence leave event:', key, leftPresences);
        })
        .subscribe((status) => {
          console.log('Channel subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('Channel successfully subscribed');
            resolve();
          }
        });
    });
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

  async joinRoom(roomId: string, userId: string, userName: string) {
    console.log(`Joining room: ${roomId} as ${userName} (${userId})`);
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    this.currentUserName = userName;

    // Setup Supabase channel for real-time communication and wait for subscription
    await this.setupChannel(roomId);
    
    // Broadcast user joined
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'user-joined',
        payload: { userId, userName, roomId }
      });
    }
    
    // Use presence to track participants
    this.channel?.track({
      userId,
      userName,
      isMuted: false,
      timestamp: Date.now()
    });
  }

  leaveRoom(roomId: string, userId: string) {
    // Broadcast user left
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'user-left',
        payload: { userId }
      });
      
      // Untrack presence
      this.channel.untrack();
      this.channel.unsubscribe();
    }

    this.currentRoomId = null;
    this.currentUserId = null;
    this.currentUserName = null;
    this.channel = null;
  }

  sendSignal(roomId: string, signal: any, targetUserId: string) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: {
          roomId,
          signal,
          fromUserId: this.currentUserId,
          targetUserId,
          timestamp: Date.now()
        }
      });
    }
  }

  sendMuteStatus(roomId: string, isMuted: boolean) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'user-mute-status',
        payload: { userId: this.currentUserId, isMuted }
      });
      
      // Update presence
      this.channel.track({
        userId: this.currentUserId,
        userName: this.currentUserName,
        isMuted,
        timestamp: Date.now()
      });
    }
  }

  sendSpeakingStatus(roomId: string, isSpeaking: boolean) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'user-speaking-status',
        payload: { userId: this.currentUserId, isSpeaking }
      });
    }
  }

  sendVideoStatus(userId: string, hasVideo: boolean) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'user-video-status',
        payload: { userId, hasVideo }
      });
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

  onUserSpeakingStatus(callback: (data: { userId: string; isSpeaking: boolean }) => void) {
    this.on('user-speaking-status', callback);
  }

  onUserVideoStatus(callback: (data: { userId: string; hasVideo: boolean }) => void) {
    this.on('user-video-status', callback);
  }

  disconnect() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.eventHandlers.clear();
  }
}

export const socketService = SocketService.getInstance();