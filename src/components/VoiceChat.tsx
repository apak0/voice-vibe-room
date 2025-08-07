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
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speakingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize WebRTC connections - only after audio stream is ready
  const { peersCount } = useWebRTC(roomId, userId, userName, streamRef.current);

  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    console.log(`Initializing VoiceChat for user: ${userName} (${userId}) in room: ${roomId}`);
    
    const initializeChat = async () => {
      await initializeAudio();
      
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

      const handleUserSpeakingStatus = (data: { userId: string; isSpeaking: boolean }) => {
        console.log("User speaking status received:", data);
        
        // Clear existing timeout for this user
        const existingTimeout = speakingTimeoutsRef.current.get(data.userId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          speakingTimeoutsRef.current.delete(data.userId);
        }
        
        if (data.isSpeaking) {
          // Immediately show speaking state
          setParticipants(prev => prev.map(p => 
            p.id === data.userId ? { ...p, isSpeaking: true } : p
          ));
        } else {
          // Delay hiding speaking state by 1 second
          const timeout = setTimeout(() => {
            setParticipants(prev => prev.map(p => 
              p.id === data.userId ? { ...p, isSpeaking: false } : p
            ));
            speakingTimeoutsRef.current.delete(data.userId);
          }, 1000);
          
          speakingTimeoutsRef.current.set(data.userId, timeout);
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

      // Set up event listeners
      socketService.onUserJoined(handleUserJoined);
      socketService.onUserLeft(handleUserLeft);
      socketService.onRoomParticipants(handleRoomParticipants);
      socketService.onUserMuteStatus(handleUserMuteStatus);
      socketService.onUserSpeakingStatus(handleUserSpeakingStatus);

      // Set up presence tracking for Supabase realtime - only call once
      socketService.joinRoom(roomId, userId, userName);
    };

    initializeChat();

    return () => {
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
    let lastSpeakingState = false;
    
    const updateVolume = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((acc, value) => acc + value, 0) / dataArray.length;
      const normalizedVolume = Math.min(100, (average / 128) * 100);
      
      setVolumeLevel(normalizedVolume);
      
      // Determine if currently speaking
      const currentlySpeaking = normalizedVolume > 10 && !isMuted;
      
      // Broadcast speaking status change to other participants
      if (currentlySpeaking !== lastSpeakingState) {
        socketService.sendSpeakingStatus(roomId, currentlySpeaking);
        lastSpeakingState = currentlySpeaking;
        
        // Clear existing timeout
        if (speakingTimeoutRef.current) {
          clearTimeout(speakingTimeoutRef.current);
          speakingTimeoutRef.current = null;
        }
        
        if (currentlySpeaking) {
          // Immediately show speaking state for current user
          setParticipants(prev => prev.map(p => 
            p.name === userName ? { ...p, isSpeaking: true } : p
          ));
        } else {
          // Delay hiding speaking state by 1 second for current user
          speakingTimeoutRef.current = setTimeout(() => {
            setParticipants(prev => prev.map(p => 
              p.name === userName ? { ...p, isSpeaking: false } : p
            ));
            speakingTimeoutRef.current = null;
          }, 1000);
        }
      }
      
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
    // Clear speaking timeouts
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
    }
    speakingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    speakingTimeoutsRef.current.clear();
    
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
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Voice Chat Room
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="text-sm text-muted-foreground font-mono bg-muted/30 px-3 py-1 rounded-md">
                  {roomId}
                </span>
                <Button variant="ghost" size="sm" onClick={copyRoomId} className="w-fit">
                  Copy Room ID
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-card/50 backdrop-blur-sm border border-border/30 rounded-lg px-4 py-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">
                {participants.length + peersCount} participant{(participants.length + peersCount) !== 1 ? 's' : ''}
              </span>
              {peersCount > 0 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                  {peersCount} connected
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Participants */}
          <div className="lg:col-span-2 space-y-6">
            {/* Participants Grid */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Participants</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {participants.map(participant => (
                  <Card 
                    key={participant.id} 
                    className={`p-4 transition-all duration-300 border-2 relative overflow-hidden ${
                      participant.isSpeaking 
                        ? 'border-primary shadow-lg shadow-primary/50 bg-gradient-to-br from-primary/15 to-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {/* Speaking glow effect */}
                    {participant.isSpeaking && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 bg-primary/5 rounded-lg" />
                        <div className="absolute inset-0 border-2 border-primary/40 rounded-lg" />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3">
                        <div className={`relative w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${
                          participant.isSpeaking 
                            ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/60' 
                            : 'bg-muted text-muted-foreground hover:scale-105'
                        }`}>
                          {participant.name.charAt(0).toUpperCase()}
                          
                          {/* Steady glow ring for speaking */}
                          {participant.isSpeaking && (
                            <>
                              <div className="absolute inset-0 rounded-full border-2 border-primary/60" />
                              <div className="absolute -inset-1 rounded-full border border-primary/40" />
                              <div className="absolute -inset-2 rounded-full border border-primary/20" />
                            </>
                          )}
                        </div>
                        <div>
                          <p className={`font-medium transition-all duration-300 ${
                            participant.isSpeaking ? 'text-primary scale-105' : 'text-foreground'
                          }`}>
                            {participant.name}
                          </p>
                          <p className={`text-xs transition-all duration-300 font-medium ${
                            participant.isSpeaking 
                              ? 'text-primary' 
                              : 'text-muted-foreground'
                          }`}>
                            {participant.isSpeaking ? (
                              <span className="flex items-center gap-1">
                                🔊 Speaking
                                <span className="inline-block w-2 h-2 bg-primary rounded-full" />
                              </span>
                            ) : (
                              'Quiet'
                            )}
                          </p>
                        </div>
                      </div>
                      {participant.isMuted && (
                        <div className="p-2 rounded-full bg-destructive/10 animate-pulse">
                          <MicOff className="w-4 h-4 text-destructive" />
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Voice Testing */}
            <Card className="p-6 bg-gradient-to-br from-card via-card to-muted/20">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Audio Testing</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={testMicrophone}
                    disabled={isTesting}
                    className="flex items-center gap-2 h-12 bg-background/50 hover:bg-primary/10 hover:border-primary/50"
                  >
                    <Mic className="w-4 h-4" />
                    {isTesting ? 'Testing Microphone...' : 'Test Microphone'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={testSpeakers}
                    className="flex items-center gap-2 h-12 bg-background/50 hover:bg-primary/10 hover:border-primary/50"
                  >
                    <Volume2 className="w-4 h-4" />
                    Test Speakers
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Test your audio devices to ensure voice chat is working correctly
                </p>
              </div>
            </Card>
          </div>

          {/* Right Panel - Controls & Activity */}
          <div className="space-y-6">
            {/* Voice Activity */}
            <Card className="p-6 bg-gradient-to-br from-primary/5 via-card to-accent/5">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground text-center">Voice Activity</h3>
                <div className="space-y-3">
                  <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-150 rounded-full"
                      style={{ width: `${volumeLevel}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className={`font-medium transition-colors ${
                      volumeLevel > 10 && !isMuted ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {volumeLevel > 10 && !isMuted ? 'Speaking' : 'Quiet'}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {Math.round(volumeLevel)}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Controls */}
            <Card className="p-6 bg-gradient-to-br from-card via-card to-primary/5">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-foreground text-center">Controls</h3>
                
                <div className="flex justify-center gap-4">
                  <Button
                    variant={isMuted ? "destructive" : "outline"}
                    size="lg"
                    onClick={toggleMute}
                    className="w-16 h-16 rounded-full transition-all duration-300 hover:scale-105"
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>
                  
                  <Button
                    variant={isDeafened ? "destructive" : "outline"}
                    size="lg"
                    onClick={toggleDeafen}
                    className="w-16 h-16 rounded-full transition-all duration-300 hover:scale-105"
                  >
                    {isDeafened ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={leaveRoom}
                    className="w-16 h-16 rounded-full transition-all duration-300 hover:scale-105"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>
                
                <div className="space-y-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    {isMuted ? 'Microphone muted' : 'Microphone active'}
                    {isDeafened ? ' • Audio deafened' : ' • Audio enabled'}
                  </p>
                  <div className="flex justify-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isConnected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isConnected ? 'Connected' : 'Connecting...'}
                    </span>
                    {peersCount > 0 && (
                      <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
                        {peersCount} WebRTC peers
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};