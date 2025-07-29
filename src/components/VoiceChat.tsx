import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Phone, PhoneOff, Users, Volume2, VolumeX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useWebRTC } from '@/hooks/useWebRTC';

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
  const [userId] = useState(() => uuidv4());
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize WebRTC connections
  const { peersCount } = useWebRTC(roomId, userId, streamRef.current);

  useEffect(() => {
    initializeAudio();
    
    // Add current user to participants
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

    return () => {
      cleanup();
    };
  }, []);

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
      
      toast({
        title: !isMuted ? "Microphone muted" : "Microphone unmuted",
      });
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
    toast({
      title: !isDeafened ? "Audio deafened" : "Audio enabled",
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