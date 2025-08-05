import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Phone, PhoneOff, Users, Volume2, VolumeX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useWebRTC } from '@/hooks/useWebRTC';
import { socketService } from '@/services/socketService';

interface Participant {
  id: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

interface VoiceChatProps {
  onLeaveRoom: () => void;
  roomId: string;
  userName: string;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({ onLeaveRoom, roomId, userName }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [userId] = useState(() => uuidv4());
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize WebRTC connections
  const { peersCount } = useWebRTC(roomId, userId, userName, streamRef.current);

  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    console.log(`Initializing VoiceChat for user: ${userName} (${userId}) in room: ${roomId}`);
    
    initializeAudio();
    
    // Initialize with current user
    setParticipants([
      {
        id: userId,
        name: userName,
        isSpeaking: false,
        isMuted: false
      }
    ]);
    
    setIsConnected(true);
    toast({
      title: "Connected to voice chat",
      description: `Joined room: ${roomId}`,
    });

    // Socket event listeners for participants
    const handleUserJoined = (data: { userId: string; userName: string }) => {
      console.log(`User joined event received:`, data);
      if (data.userId !== userId) {
        setParticipants(prev => {
          const exists = prev.find(p => p.id === data.userId);
          if (!exists) {
            const newList = [...prev, {
              id: data.userId,
              name: data.userName,
              isSpeaking: false,
              isMuted: false
            }];
            console.log(`Added user to participants:`, newList);
            return newList;
          }
          return prev;
        });
      }
    };

    const handleUserLeft = (leftUserId: string) => {
      console.log(`User left event received:`, leftUserId);
      setParticipants(prev => {
        const newList = prev.filter(p => p.id !== leftUserId);
        console.log(`Removed user from participants:`, newList);
        return newList;
      });
      
      // Clean up audio element for left user
      const audioElement = audioElementsRef.current.get(leftUserId);
      if (audioElement) {
        audioElement.remove();
        audioElementsRef.current.delete(leftUserId);
      }
    };

    const handleRoomParticipants = (roomParticipants: { userId: string; userName: string }[]) => {
      console.log('Room participants received:', roomParticipants);
      
      // Current user should always be included
      const currentUserParticipant = {
        id: userId,
        name: userName,
        isSpeaking: false,
        isMuted: false
      };

      // Other participants
      const otherParticipants = roomParticipants
        .filter(p => p.userId !== userId)
        .map(p => ({
          id: p.userId,
          name: p.userName,
          isSpeaking: false,
          isMuted: false
        }));
      
      const allParticipants = [currentUserParticipant, ...otherParticipants];
      console.log('Setting all participants:', allParticipants);
      setParticipants(allParticipants);
    };

    const handleUserMuteStatus = (data: { userId: string; isMuted: boolean }) => {
      console.log(`User mute status received:`, data);
      setParticipants(prev => prev.map(p => 
        p.id === data.userId ? { ...p, isMuted: data.isMuted } : p
      ));
    };

    // Update localStorage heartbeat for current user
    const updateHeartbeat = () => {
      const participantsKey = `room_${roomId}_participants`;
      const storedParticipants = JSON.parse(localStorage.getItem(participantsKey) || '[]');
      
      // Update or add current user
      const updatedParticipants = storedParticipants.filter((p: any) => p.userId !== userId);
      updatedParticipants.push({
        userId,
        userName,
        isMuted: false,
        timestamp: Date.now()
      });
      
      localStorage.setItem(participantsKey, JSON.stringify(updatedParticipants));
    };

    // Set up event listeners
    socketService.onUserJoined(handleUserJoined);
    socketService.onUserLeft(handleUserLeft);
    socketService.onRoomParticipants(handleRoomParticipants);
    socketService.onUserMuteStatus(handleUserMuteStatus);

    // Update heartbeat every 5 seconds
    const heartbeatInterval = setInterval(updateHeartbeat, 5000);
    updateHeartbeat(); // Initial call

    // Set up presence tracking for Supabase realtime
    socketService.joinRoom(roomId, userId, userName);

    return () => {
      clearInterval(heartbeatInterval);
      cleanup();
    };
  }, [userId, userName, roomId]);

  const initializeAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;
      
      // Create audio context for volume analysis
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      microphoneRef.current.connect(analyser);
      analyserRef.current = analyser;
      
      // Start volume monitoring
      monitorVolume();
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to join voice chat.",
        variant: "destructive"
      });
    }
  };

  const monitorVolume = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateVolume = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((acc, value) => acc + value, 0) / dataArray.length;
      const normalizedVolume = Math.min(100, (average / 128) * 100);
      
      setVolumeLevel(normalizedVolume);
      
      // Update speaking status for current user
      setParticipants(prev => prev.map(p => 
        p.name === userName 
          ? { ...p, isSpeaking: normalizedVolume > 10 && !isMuted }
          : p
      ));
      
      requestAnimationFrame(updateVolume);
    };
    
    updateVolume();
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      
      // Update local participant state
      setParticipants(prev => prev.map(p => 
        p.id === userId ? { ...p, isMuted: !isMuted } : p
      ));
      
      // Send mute status to other users
      socketService.sendMuteStatus(roomId, !isMuted);
      
      toast({
        title: !isMuted ? "Microphone muted" : "Microphone unmuted",
      });
    }
  };

  const toggleDeafen = () => {
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);
    
    // Mute/unmute all remote audio elements
    document.querySelectorAll('[id^="audio-"]').forEach((audioElement) => {
      const audio = audioElement as HTMLAudioElement;
      audio.muted = newDeafenState;
    });
    
    toast({
      title: newDeafenState ? "Audio deafened" : "Audio enabled",
    });
  };

  const leaveRoom = () => {
    cleanup();
    onLeaveRoom();
    toast({
      title: "Left voice chat",
      description: "You have disconnected from the room.",
    });
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const testMicrophone = async () => {
    setIsTesting(true);
    try {
      if (!streamRef.current) {
        await initializeAudio();
      }
      
      if (streamRef.current && audioContextRef.current) {
        // Create audio context for loopback
        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        const gainNode = audioContextRef.current.createGain();
        
        // Set low gain to prevent feedback but allow hearing
        gainNode.gain.value = 0.3;
        
        // Connect microphone to speakers through gain control
        source.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        
        testAudioRef.current = { source, gainNode } as any;
        
        toast({
          title: "Microphone Test Active",
          description: "You should hear your own voice. Speak into the microphone. Test will stop in 5 seconds.",
        });
        
        // Stop test after 5 seconds
        setTimeout(() => {
          if (testAudioRef.current) {
            const { source, gainNode } = testAudioRef.current as any;
            source.disconnect();
            gainNode.disconnect();
            testAudioRef.current = null;
          }
          setIsTesting(false);
          toast({
            title: "Microphone test completed",
          });
        }, 5000);
      }
    } catch (error) {
      console.error('Error testing microphone:', error);
      toast({
        title: "Microphone test failed",
        description: "Unable to access microphone for testing.",
        variant: "destructive"
      });
      setIsTesting(false);
    }
  };

  const testSpeakers = () => {
    // Play a test tone
    if (audioContextRef.current) {
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.frequency.value = 440; // A4 note
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContextRef.current.currentTime + 1);
      
      toast({
        title: "Speaker Test",
        description: "You should hear a beep sound if speakers are working.",
      });
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast({
      title: "Room ID copied!",
      description: "Share this ID with friends to invite them.",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Voice Chat Room</h1>
              <div className="flex items-center gap-4">
                <p className="text-muted-foreground">Room ID: {roomId}</p>
                <Button variant="ghost" size="sm" onClick={copyRoomId}>
                  Copy ID
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-5 h-5" />
              <span>{participants.length + peersCount} participant{(participants.length + peersCount) !== 1 ? 's' : ''}</span>
              {peersCount > 0 && (
                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                  {peersCount} connected
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Debug Info */}
        <Card className="p-4 mb-6 bg-muted/50">
          <div className="text-sm text-muted-foreground">
            <p><strong>Debug Info:</strong></p>
            <p>Room ID: {roomId}</p>
            <p>Your User ID: {userId}</p>
            <p>Your Name: {userName}</p>
            <p>Participants in state: {participants.length}</p>
            <p>WebRTC peers: {peersCount}</p>
            <div className="mt-2">
              <p><strong>Participants:</strong></p>
              {participants.map(p => (
                <div key={p.id} className="ml-2">
                  • {p.name} ({p.id.substring(0, 8)}...) {p.isMuted ? '🔇' : '🎤'} {p.isSpeaking ? '🗣️' : ''}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Participants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {participants.map(participant => (
            <Card 
              key={participant.id} 
              className={`p-4 transition-all duration-300 ${
                participant.isSpeaking ? 'animate-pulse border-primary' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    participant.isSpeaking ? 'bg-primary' : 'bg-muted'
                  }`}>
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{participant.name}</p>
                    <p className={`text-xs ${
                      participant.isSpeaking ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {participant.isSpeaking ? 'Speaking' : 'Quiet'}
                    </p>
                  </div>
                </div>
                {participant.isMuted && (
                  <MicOff className="w-4 h-4 text-destructive" />
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Voice Activity Indicator */}
        <Card className="p-6 mb-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Your Voice Activity</h3>
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${volumeLevel}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground w-12">
                {Math.round(volumeLevel)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {volumeLevel > 10 && !isMuted ? 'You are speaking' : 'You are quiet'}
            </p>
          </div>
        </Card>

        {/* Voice Testing */}
        <Card className="p-6 mb-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Voice Testing</h3>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                onClick={testMicrophone}
                disabled={isTesting}
                className="flex items-center gap-2"
              >
                <Mic className="w-4 h-4" />
                {isTesting ? 'Testing Microphone...' : 'Test Microphone'}
              </Button>
              <Button
                variant="outline"
                onClick={testSpeakers}
                className="flex items-center gap-2"
              >
                <Volume2 className="w-4 h-4" />
                Test Speakers
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Test your audio devices to ensure voice chat is working correctly
            </p>
          </div>
        </Card>

        {/* Controls */}
        <Card className="p-6">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "outline"}
              size="lg"
              onClick={toggleMute}
              className="w-16 h-16 rounded-full"
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>
            
            <Button
              variant={isDeafened ? "destructive" : "outline"}
              size="lg"
              onClick={toggleDeafen}
              className="w-16 h-16 rounded-full"
            >
              {isDeafened ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </Button>
            
            <Button
              variant="destructive"
              size="lg"
              onClick={leaveRoom}
              className="w-16 h-16 rounded-full"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
          
          <div className="mt-4 text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              {isMuted ? 'Microphone muted' : 'Microphone active'}
              {isDeafened ? ' • Audio deafened' : ' • Audio enabled'}
            </p>
            <p className="text-xs text-muted-foreground">
              Status: {isConnected ? 'Connected' : 'Connecting...'} • WebRTC: {peersCount > 0 ? `${peersCount} peers` : 'No peers'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};