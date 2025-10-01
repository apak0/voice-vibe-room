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
      // Check if stream has video tracks
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length === 0) {
        console.log('VideoManager: No video tracks in stream, waiting...');
        return;
      }
      
      console.log('VideoManager: Setting up local video stream', {
        streamId: localStream.id,
        videoTracks: videoTracks.length,
        audioTracks: localStream.getAudioTracks().length,
        videoTrackEnabled: videoTracks[0]?.enabled
      });
      
      // Set the stream
      videoElement.srcObject = localStream;
      
      // Play the video
      const playVideo = async () => {
        try {
          await videoElement.play();
          console.log('VideoManager: Local video playing successfully');
        } catch (error) {
          console.error('VideoManager: Error playing local video:', error);
          // Retry after a short delay
          setTimeout(async () => {
            try {
              await videoElement.play();
              console.log('VideoManager: Video retry successful');
            } catch (retryError) {
              console.error('VideoManager: Video retry failed:', retryError);
            }
          }, 200);
        }
      };
      
      playVideo();
    } else {
      console.log('VideoManager: Clearing local video stream', {
        videoEnabled: isVideoEnabled,
        hasStream: !!localStream,
        streamId: localStream?.id
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