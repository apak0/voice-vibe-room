import React, { useRef, useEffect, useCallback } from 'react';

interface VideoManagerProps {
  isVideoEnabled: boolean;
  localStream: MediaStream | null;
  userId: string;
  className?: string;
}

export const VideoManager: React.FC<VideoManagerProps> = ({
  isVideoEnabled,
  localStream,
  userId,
  className = ""
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle local video stream assignment
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      console.log('VideoManager: Video element not available yet');
      return;
    }

    if (isVideoEnabled && localStream) {
      console.log('VideoManager: Setting up local video stream', {
        streamId: localStream.id,
        videoTracks: localStream.getVideoTracks().length,
        audioTracks: localStream.getAudioTracks().length
      });
      
      videoElement.srcObject = localStream;
      
      videoElement.play()
        .then(() => {
          console.log('VideoManager: Local video playing successfully');
        })
        .catch(error => {
          console.error('VideoManager: Error playing local video:', error);
          // Retry once after a short delay
          setTimeout(() => {
            videoElement.play().catch(e => 
              console.error('VideoManager: Video retry failed:', e)
            );
          }, 100);
        });
    } else {
      console.log('VideoManager: Clearing local video stream', {
        videoEnabled: isVideoEnabled,
        hasStream: !!localStream
      });
      videoElement.srcObject = null;
    }
  }, [isVideoEnabled, localStream]);

  if (!isVideoEnabled) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`w-full h-full object-cover transform scale-x-[-1] ${className}`}
      style={{ backgroundColor: '#000' }}
    />
  );
};