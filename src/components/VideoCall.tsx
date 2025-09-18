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

  // Calculate total participants including local user
  const totalParticipants = remoteStreams.size + (localStream ? 1 : 0);
  
  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* All videos - main area */}
      <div className="flex justify-center items-start pt-8">
        <div className="grid gap-3 max-w-4xl w-full">
        {totalParticipants === 0 ? (
          <Card className="flex items-center justify-center h-64 bg-muted/50">
            <div className="text-center">
              <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No video available</p>
              <p className="text-sm text-muted-foreground">Enable your camera to start</p>
            </div>
          </Card>
        ) : (
          <div className={`grid gap-3 ${
            totalParticipants === 1 ? 'grid-cols-1' : 
            totalParticipants === 2 ? 'grid-cols-2' : 
            totalParticipants <= 4 ? 'grid-cols-2 grid-rows-2' : 
            'grid-cols-3 grid-rows-2'
          }`}>
            {/* Local video in main grid */}
            {localStream && (
              <Card key="local" className="relative overflow-hidden bg-black h-48 w-64">
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
                    <VideoOff className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}
                
                {/* Local user info overlay */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <Badge variant="default" className="text-xs bg-primary">
                    You
                  </Badge>
                  <div className="flex gap-1">
                    {isMuted && (
                      <Badge variant="destructive" className="p-1">
                        <MicOff className="w-3 h-3" />
                      </Badge>
                    )}
                    {!isVideoEnabled && (
                      <Badge variant="outline" className="p-1">
                        <VideoOff className="w-3 h-3" />
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            )}
            
            {/* Remote videos in main grid */}
            {Array.from(remoteStreams.entries()).map(([userId, streamData]) => {
              const participant = getParticipantInfo(userId);
              const hasVideo = streamData.stream.getVideoTracks().length > 0;
              
              return (
                <Card key={userId} className="relative overflow-hidden bg-black h-48 w-64">
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
                      <VideoOff className="w-12 h-12 text-muted-foreground" />
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
      </div>
    </div>
  );
};