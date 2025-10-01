import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Mic, MicOff, Phone, PhoneOff, Users, Volume2, VolumeX, Copy, Video, VideoOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useSimplePeer } from '@/hooks/useSimplePeer';
import { socketService } from '@/services/socketService';
import { VideoCall } from './VideoCall';
import { ConnectionDebug } from './ConnectionDebug';

interface Participant {
  id: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  hasVideo: boolean;
}

interface VoiceChatProps {
  onLeaveRoom: () => void;
  roomId: string;
  userName: string;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({ onLeaveRoom, roomId, userName }) => {
  const { t } = useTranslation();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [pttActive, setPttActive] = useState(false);
  const [userId] = useState(() => uuidv4());
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speakingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize SimplePeer connections - only after stream is ready
  const { remoteStreams, peersCount } = useSimplePeer(roomId, userId, userName, streamRef.current);

  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    console.log(`Initializing VoiceChat for user: ${userName} (${userId}) in room: ${roomId}`);
    
    const initializeChat = async () => {
      await initializeMedia();
      
      // Initialize with current user
      setParticipants([
        {
          id: userId,
          name: userName,
          isSpeaking: false,
          isMuted: false,
          hasVideo: isVideoEnabled
        }
      ]);
      
      setIsConnected(true);
      toast({
        title: t('connected'),
        description: `${t('roomId')}: ${roomId}`,
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
                isMuted: false,
                hasVideo: false
              }];
              console.log(`Added user to participants:`, newList.map(p => ({ id: p.id, name: p.name })));
              return newList;
            }
            return prev;
          });
          
          // Send our video status to new participant
          if (isVideoEnabled && streamRef.current) {
            setTimeout(() => {
              socketService.sendVideoStatus(userId, true);
            }, 1000); // Small delay to ensure they're ready
          }
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
        
        // Update speaking status
        setParticipants(prev => prev.map(p => 
          p.id === data.userId 
            ? { ...p, isSpeaking: data.isSpeaking } 
            : p
        ));
        
        // If they stopped speaking, set a timeout to ensure UI updates
        if (!data.isSpeaking) {
          const timeoutId = setTimeout(() => {
            setParticipants(prev => prev.map(p => 
              p.id === data.userId ? { ...p, isSpeaking: false } : p
            ));
            speakingTimeoutsRef.current.delete(data.userId);
          }, 500);
          
          speakingTimeoutsRef.current.set(data.userId, timeoutId);
        }
      };

      const handleUserVideoStatus = (data: { userId: string; hasVideo: boolean }) => {
        console.log("User video status received:", data);
        setParticipants(prev => prev.map(p => 
          p.id === data.userId ? { ...p, hasVideo: data.hasVideo } : p
        ));
      };

      const handleUserLeft = (leftUserId: string) => {
        console.log(`User left event received: ${leftUserId}`);
        setParticipants(prev => prev.filter(p => p.id !== leftUserId));
        
        // Clear any speaking timeout for this user
        const timeoutId = speakingTimeoutsRef.current.get(leftUserId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          speakingTimeoutsRef.current.delete(leftUserId);
        }
      };

      const handleRoomParticipants = (roomParticipants: { userId: string; userName: string; isMuted?: boolean }[]) => {
        console.log('Room participants received:', roomParticipants);
        
        // Create participant list with proper state management
        const allParticipants = roomParticipants.map(p => {
          const isCurrentUser = p.userId === userId;
          return {
            id: p.userId,
            name: p.userName,
            isSpeaking: false,
            isMuted: isCurrentUser ? isMuted : (p.isMuted || false),
            hasVideo: isCurrentUser ? (isVideoEnabled && !!streamRef.current?.getVideoTracks().length) : false
          };
        });
        
        // Add current user if not in the list
        const currentUserExists = allParticipants.find(p => p.id === userId);
        if (!currentUserExists) {
          allParticipants.push({
            id: userId,
            name: userName,
            isSpeaking: false,
            isMuted,
            hasVideo: isVideoEnabled && !!streamRef.current?.getVideoTracks().length
          });
        }
        
        console.log('Setting all participants:', allParticipants.map(p => ({
          id: p.id,
          name: p.name,
          hasVideo: p.hasVideo,
          isMuted: p.isMuted
        })));
        
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
      socketService.onUserVideoStatus(handleUserVideoStatus);

      // Set up presence tracking for Supabase realtime - only call once
      await socketService.joinRoom(roomId, userId, userName);
    };

    initializeChat();

    return () => {
      cleanup();
    };
  }, [userId, userName, roomId]);

  const initializeMedia = async () => {
    try {
      console.log('Initializing media with video support');
      const constraints = { 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      };
      
      console.log('Requesting media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Media stream obtained:', {
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length
      });
      
      streamRef.current = stream;
      
      // If video is not enabled initially, disable video tracks
      if (!isVideoEnabled) {
        stream.getVideoTracks().forEach(track => {
          track.enabled = false;
        });
      }
      
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
      console.error('Error accessing microphone/camera:', error);
      toast({
        title: t('microphoneAccess'),
        description: t('microphoneAccess'),
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
      
      // Determine if currently speaking (only if not push-to-talk mode)
      const currentlySpeaking = pushToTalk 
        ? pttActive && normalizedVolume > 5  
        : normalizedVolume > 10 && !isMuted;
      
      // Broadcast speaking status change to other participants
      if (currentlySpeaking !== lastSpeakingState) {
        socketService.sendSpeakingStatus(roomId, currentlySpeaking);
        lastSpeakingState = currentlySpeaking;
        
        // Clear existing timeout
        if (speakingTimeoutRef.current) {
          clearTimeout(speakingTimeoutRef.current);
        }
        
        // Update local participant speaking status
        setParticipants(prev => prev.map(p => 
          p.id === userId ? { ...p, isSpeaking: currentlySpeaking } : p
        ));
        
        // Set timeout to stop speaking indication if no more activity
        if (currentlySpeaking) {
          speakingTimeoutRef.current = setTimeout(() => {
            setParticipants(prev => prev.map(p => 
              p.id === userId ? { ...p, isSpeaking: false } : p
            ));
            socketService.sendSpeakingStatus(roomId, false);
            lastSpeakingState = false;
          }, 1000);
        }
      }
      
      requestAnimationFrame(updateVolume);
    };
    
    updateVolume();
  };

  const cleanup = () => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Cleanup audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    // Clear timeouts
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
    }
    
    speakingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    speakingTimeoutsRef.current.clear();
    
    // Leave room
    socketService.leaveRoom(roomId, userId);
    socketService.disconnect();
  };

  const toggleMute = () => {
    if (pushToTalk) return; // Can't manually mute in push-to-talk mode
    
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted; // Flip the current state
      });
    }
    
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // Update participant list to reflect mute status
    setParticipants(prev => prev.map(p => 
      p.id === userId ? { ...p, isMuted: newMutedState } : p
    ));
    
    // Broadcast mute status to other participants
    socketService.sendMuteStatus(roomId, newMutedState);
    
    toast({
      title: newMutedState ? t('mute') : t('unmute'),
      description: newMutedState ? "Microphone muted" : "Microphone unmuted",
    });
  };

  const toggleDeafen = () => {
    const newDeafenedState = !isDeafened;
    setIsDeafened(newDeafenedState);
    
    // Control all remote audio elements
    document.querySelectorAll('[id^="audio-"]').forEach((audioElement) => {
      const audio = audioElement as HTMLAudioElement;
      audio.muted = newDeafenedState;
    });
    
    toast({
      title: newDeafenedState ? t('deafen') : t('undeafen'),
      description: newDeafenedState ? "All audio deafened" : "Audio restored",
    });
  };

  const toggleVideo = () => {
    if (!streamRef.current) return;

    const videoTracks = streamRef.current.getVideoTracks();
    if (videoTracks.length === 0) {
      toast({
        title: "Video error",
        description: "No camera available.",
        variant: "destructive"
      });
      return;
    }

    const newVideoState = !isVideoEnabled;
    
    // Enable/disable video tracks
    videoTracks.forEach(track => {
      track.enabled = newVideoState;
    });
    
    setIsVideoEnabled(newVideoState);
    setParticipants(prev => prev.map(p => 
      p.id === userId ? { ...p, hasVideo: newVideoState } : p
    ));
    
    // Broadcast video status when it changes
    if (streamRef.current) {
      socketService.sendVideoStatus(userId, newVideoState);
    }
    
    toast({
      title: newVideoState ? "Video enabled" : "Video disabled",
      description: newVideoState ? "Camera has been turned on." : "Camera has been turned off.",
    });
  };

  const leaveRoom = () => {
    cleanup();
    onLeaveRoom();
  };

  // Push-to-talk functionality
  const handlePTTDown = () => {
    if (!pushToTalk || !streamRef.current) return;
    
    const audioTracks = streamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = true;
    });
    
    setPttActive(true);
    setIsMuted(false);
    
    // Update participant list
    setParticipants(prev => prev.map(p => 
      p.id === userId ? { ...p, isMuted: false } : p
    ));
    
    socketService.sendMuteStatus(roomId, false);
  };

  const handlePTTUp = () => {
    if (!pushToTalk || !streamRef.current) return;
    
    const audioTracks = streamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = false;
    });
    
    setPttActive(false);
    setIsMuted(true);
    
    // Update participant list
    setParticipants(prev => prev.map(p => 
      p.id === userId ? { ...p, isMuted: true } : p
    ));
    
    socketService.sendMuteStatus(roomId, true);
  };

  // Keyboard listener for push-to-talk
  useEffect(() => {
    if (!pushToTalk) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !pttActive) {
        event.preventDefault();
        handlePTTDown();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && pttActive) {
        event.preventDefault();
        handlePTTUp();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [pushToTalk, pttActive]);

  // Set initial audio track state when push-to-talk is toggled
  useEffect(() => {
    if (!streamRef.current) return;
    
    const audioTracks = streamRef.current.getAudioTracks();
    if (pushToTalk) {
      // In push-to-talk mode, start with audio disabled
      audioTracks.forEach(track => {
        track.enabled = false;
      });
      setIsMuted(false); // Reset mute state since we're controlling via PTT
    } else {
      // In normal mode, audio should be enabled unless manually muted
      audioTracks.forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [pushToTalk]);


  const testMicrophone = async () => {
    if (isTesting) return;
    
    setIsTesting(true);
    try {
      if (streamRef.current && audioContextRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        const gainNode = audioContextRef.current.createGain();
        
        // Set low gain to prevent feedback but allow hearing
        gainNode.gain.value = 0.3;
        
        // Connect microphone to speakers through gain control
        source.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        
        testAudioRef.current = { source, gainNode } as any;
        
        toast({
          title: t('testMicrophone'),
          description: t('audioTesting'),
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
            title: t('testMicrophone'),
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
        title: t('testSpeakers'),
        description: t('audioTesting'),
      });
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast({
      title: t('roomIdCopied'),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">{t('voiceChat')}</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('room')}:</span>
              <code className="px-2 py-1 bg-muted rounded text-sm font-mono text-foreground">{roomId}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyRoomId}
                className="hover:bg-muted"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{participants.length} {t('connected')}</span>
            {peersCount > 0 && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-primary">{peersCount} P2P</span>
              </>
            )}
          </div>
        </div>

        {/* Debug Info for Development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6">
            <ConnectionDebug
              participants={participants}
              remoteStreams={remoteStreams}
              peersCount={peersCount}
              localStreamActive={!!streamRef.current && 
                !!(streamRef.current.getAudioTracks().length || streamRef.current.getVideoTracks().length)}
            />
          </div>
        )}

        {/* Video Call Interface */}
        <div className="mb-6">
          <VideoCall
            localStream={streamRef.current}
            remoteStreams={remoteStreams}
            isVideoEnabled={isVideoEnabled}
            isMuted={isMuted}
            participants={participants}
            currentUserId={userId}
          />
        </div>

        {/* Controls and Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Voice Testing */}
            <Card className="p-6 bg-gradient-to-br from-card via-card to-muted/20">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">{t('audioTesting')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={testMicrophone}
                    disabled={isTesting}
                    className="h-12 transition-all duration-300 hover:scale-105"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    {isTesting ? "Testing..." : t('testMicrophone')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={testSpeakers}
                    className="h-12 transition-all duration-300 hover:scale-105"
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    {t('testSpeakers')}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Panel - Controls */}
          <div className="space-y-6">
            {/* Voice Activity */}
            <Card className="p-6 bg-gradient-to-br from-card via-card to-accent/5">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">{t('voiceActivity')}</h3>
                
                {/* Volume Meter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('volume')}</span>
                    <span className="font-mono text-primary">{Math.round(volumeLevel)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-100 ${
                        volumeLevel > 50 ? 'bg-primary' : volumeLevel > 20 ? 'bg-accent' : 'bg-muted-foreground'
                      }`}
                      style={{ width: `${volumeLevel}%` }}
                    />
                  </div>
                </div>

                {/* Push to Talk Settings */}
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <label htmlFor="pushToTalk" className="text-sm font-medium text-foreground">
                      {t('pushToTalk')}
                    </label>
                    <Switch
                      id="pushToTalk"
                      checked={pushToTalk}
                      onCheckedChange={setPushToTalk}
                    />
                  </div>
                  {pushToTalk && (
                    <p className="text-xs text-muted-foreground">
                      {t('holdSpaceToTalk')}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Main Controls */}
            <Card className="p-6 bg-gradient-to-br from-card via-card to-primary/5">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-center text-foreground">Controls</h3>
                
                <div className="flex justify-center gap-4">
                  <Button
                    variant={isMuted ? "destructive" : "outline"}
                    size="lg"
                    onClick={toggleMute}
                    disabled={pushToTalk}
                    title={pushToTalk ? t('pushToTalkEnabled') : undefined}
                    className="w-16 h-16 rounded-full transition-all duration-300 hover:scale-105"
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>
                  
                  <Button
                    variant={isVideoEnabled ? "default" : "outline"}
                    size="lg"
                    onClick={toggleVideo}
                    className="w-16 h-16 rounded-full transition-all duration-300 hover:scale-105"
                  >
                    {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
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
                
                <Button
                  onMouseDown={handlePTTDown}
                  onMouseUp={handlePTTUp}
                  onMouseLeave={handlePTTUp}
                  onTouchStart={(e) => { e.preventDefault(); handlePTTDown(); }}
                  onTouchEnd={handlePTTUp}
                  disabled={!pushToTalk}
                  variant={pttActive ? 'default' : 'outline'}
                  className="w-full h-12 rounded-full"
                >
                  {pttActive ? t('talking') : t('holdToTalk')}
                </Button>
                
                <div className="space-y-2 text-center">
                  <p className="text-sm text-muted-foreground">
                  {t(isMuted ? 'mute' : 'unmute')}
                  {' • '}
                  {t(isDeafened ? 'deafen' : 'undeafen')}
                  </p>
                  <div className="flex justify-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isConnected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isConnected ? t('connected') : t('connecting')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Test Audio Element */}
      <audio ref={testAudioRef} preload="auto">
        <source src="/test-sound.mp3" type="audio/mpeg" />
      </audio>
    </div>
  );
};
