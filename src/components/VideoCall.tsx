import React, { useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff, Mic, MicOff } from 'lucide-react';

interface VideoCallProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, { stream: MediaStream; userName: string }>;
  isVideoEnabled: boolean;
  isMuted: boolean;
  participants: Array<{
    id: string;
    name: string;
    hasVideo: boolean;
    isMuted: boolean;
    isSpeaking: boolean;
  }>;
}

export const VideoCall: React.FC<VideoCallProps> = ({
  localStream,
  remoteStreams,
  isVideoEnabled,
  isMuted,
  participants,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Handle local video stream
  useEffect(() => {
    const videoElement = localVideoRef.current;
    if (!videoElement) return;

    if (localStream && isVideoEnabled) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoElement.srcObject = localStream;
        videoElement.play().catch(console.error);
      }
    } else {
      videoElement.srcObject = null;
    }
  }, [localStream, isVideoEnabled]);

  // Handle remote video streams
  useEffect(() => {
    remoteStreams.forEach((streamData, userId) => {
      const videoElement = remoteVideoRefs.current.get(userId);
      if (videoElement && streamData.stream) {
        videoElement.srcObject = streamData.stream;
        videoElement.play().catch(console.error);
      }
    });

    // Cleanup removed streams
    remoteVideoRefs.current.forEach((videoElement, userId) => {
      if (!remoteStreams.has(userId)) {
        videoElement.srcObject = null;
        remoteVideoRefs.current.delete(userId);
      }
    });
  }, [remoteStreams]);

  const getParticipantInfo = (userId: string) => {
    return participants.find(p => p.id === userId);
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Remote videos - main area */}
      <div className="flex-1 grid gap-4 min-h-0">
        {remoteStreams.size === 0 ? (
          <Card className="flex items-center justify-center h-full bg-muted/50">
            <div className="text-center">
              <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Waiting for others to join...</p>
              <p className="text-sm text-muted-foreground">Share the room ID to start a video call</p>
            </div>
          </Card>
        ) : (
          <div className={`grid gap-4 h-full ${
            remoteStreams.size === 1 ? 'grid-cols-1' : 
            remoteStreams.size === 2 ? 'grid-cols-2' : 
            remoteStreams.size <= 4 ? 'grid-cols-2 grid-rows-2' : 
            'grid-cols-3 grid-rows-2'
          }`}>
            {Array.from(remoteStreams.entries()).map(([userId, streamData]) => {
              const participant = getParticipantInfo(userId);
              const hasVideo = streamData.stream.getVideoTracks().length > 0;
              
              return (
                <Card key={userId} className="relative overflow-hidden bg-black">
                  {hasVideo ? (
                    <video
                      ref={(el) => {
                        if (el) remoteVideoRefs.current.set(userId, el);
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-muted">
                      <VideoOff className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* User info overlay */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <Badge variant={participant?.isSpeaking ? "default" : "secondary"} className="text-xs">
                      {streamData.userName}
                    </Badge>
                    <div className="flex gap-1">
                      {participant?.isMuted && (
                        <Badge variant="destructive" className="p-1">
                          <MicOff className="w-3 h-3" />
                        </Badge>
                      )}
                      {!hasVideo && (
                        <Badge variant="outline" className="p-1">
                          <VideoOff className="w-3 h-3" />
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Local video - small preview */}
      {localStream && (
        <Card className="absolute bottom-4 right-4 w-48 h-36 overflow-hidden bg-black border-2">
          {isVideoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-muted">
              <VideoOff className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          
          {/* Local user info */}
          <div className="absolute bottom-1 left-1 right-1">
            <Badge variant="secondary" className="text-xs w-full justify-center">
              You {isMuted && <MicOff className="w-3 h-3 ml-1" />}
            </Badge>
          </div>
        </Card>
      )}
    </div>
  );
};