import { useRef, useCallback, useEffect } from 'react';
import { socketService } from '@/services/socketService';

interface PeerConnection {
  connection: RTCPeerConnection;
  userId: string;
}

export const useWebRTC = (roomId: string, userId: string, userName: string, localStream: MediaStream | null) => {
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const socketRef = useRef(socketService.connect());

  const createPeerConnection = useCallback((remoteUserId: string): RTCPeerConnection => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      playRemoteStream(remoteStream, remoteUserId);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendSignal(roomId, {
          type: 'ice-candidate',
          candidate: event.candidate,
        }, remoteUserId);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`Peer connection state with ${remoteUserId}:`, peerConnection.connectionState);
    };

    return peerConnection;
  }, [roomId, localStream]);

  const playRemoteStream = useCallback((stream: MediaStream, userId: string) => {
    console.log(`Playing remote stream for user: ${userId}`);
    
    // Check if stream has video tracks
    const hasVideo = stream.getVideoTracks().length > 0;
    
    if (hasVideo) {
      // Create or update video element for this user
      let videoElement = document.getElementById(`video-${userId}`) as HTMLVideoElement;
      
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.id = `video-${userId}`;
        videoElement.autoplay = true;
        videoElement.controls = false;
        videoElement.muted = false; // Don't mute video element as it contains audio too
        videoElement.setAttribute('playsinline', 'true');
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'cover';
        videoElement.className = 'rounded-lg';
        
        // Add to video container instead of body
        const videoContainer = document.getElementById(`video-container-${userId}`);
        if (videoContainer) {
          videoContainer.appendChild(videoElement);
        }
        console.log(`Created video element for user: ${userId}`);
      }

      videoElement.srcObject = stream;
      
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`Successfully playing video for user: ${userId}`);
          })
          .catch(error => {
            console.error(`Error playing video for user ${userId}:`, error);
            setTimeout(() => {
              videoElement.play().catch(e => console.error(`Video retry failed for ${userId}:`, e));
            }, 100);
          });
      }
    } else {
      // Audio only - create audio element
      let audioElement = document.getElementById(`audio-${userId}`) as HTMLAudioElement;
      
      if (!audioElement) {
        audioElement = document.createElement('audio');
        audioElement.id = `audio-${userId}`;
        audioElement.autoplay = true;
        audioElement.controls = false;
        audioElement.style.display = 'none';
        audioElement.volume = 1.0;
        audioElement.setAttribute('playsinline', 'true');
        document.body.appendChild(audioElement);
        console.log(`Created audio element for user: ${userId}`);
      }

      audioElement.srcObject = stream;
      
      const playPromise = audioElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`Successfully playing audio for user: ${userId}`);
          })
          .catch(error => {
            console.error(`Error playing audio for user ${userId}:`, error);
            setTimeout(() => {
              audioElement.play().catch(e => console.error(`Audio retry failed for ${userId}:`, e));
            }, 100);
          });
      }
    }
  }, []);

  const createOffer = useCallback(async (remoteUserId: string) => {
    try {
      const peerConnection = createPeerConnection(remoteUserId);
      peersRef.current.set(remoteUserId, { connection: peerConnection, userId: remoteUserId });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socketService.sendSignal(roomId, {
        type: 'offer',
        offer,
      }, remoteUserId);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }, [roomId, createPeerConnection]);

  const handleSignal = useCallback(async (data: { signal: any; fromUserId: string }) => {
    const { signal, fromUserId } = data;

    try {
      let peer = peersRef.current.get(fromUserId);

      if (signal.type === 'offer') {
        if (!peer) {
          const peerConnection = createPeerConnection(fromUserId);
          peer = { connection: peerConnection, userId: fromUserId };
          peersRef.current.set(fromUserId, peer);
        }

        await peer.connection.setRemoteDescription(signal.offer);
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);

        socketService.sendSignal(roomId, {
          type: 'answer',
          answer,
        }, fromUserId);
      } else if (signal.type === 'answer') {
        if (peer) {
          await peer.connection.setRemoteDescription(signal.answer);
        }
      } else if (signal.type === 'ice-candidate') {
        if (peer) {
          await peer.connection.addIceCandidate(signal.candidate);
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  }, [roomId, createPeerConnection]);

  const addUser = useCallback((data: { userId: string; userName: string }) => {
    if (data.userId !== userId) {
      createOffer(data.userId);
    }
  }, [userId, createOffer]);

  const removeUser = useCallback((leftUserId: string) => {
    const peer = peersRef.current.get(leftUserId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(leftUserId);

      // Remove audio and video elements
      const audioElement = document.getElementById(`audio-${leftUserId}`);
      const videoElement = document.getElementById(`video-${leftUserId}`);
      if (audioElement) {
        audioElement.remove();
      }
      if (videoElement) {
        videoElement.remove();
      }
    }
  }, []);

  useEffect(() => {
    // Only proceed if we have a local stream
    if (!localStream) {
      console.log('WebRTC: Waiting for local stream...');
      return;
    }

    console.log('WebRTC: Setting up with local stream');

    // Set up event listeners
    socketService.onUserJoined(addUser);
    socketService.onUserLeft(removeUser);
    socketService.onSignal(handleSignal);

    return () => {
      // Clean up connections
      peersRef.current.forEach((peer) => {
        peer.connection.close();
      });
      peersRef.current.clear();

      // Remove audio and video elements
      document.querySelectorAll('[id^="audio-"]').forEach(el => el.remove());
      document.querySelectorAll('[id^="video-"]').forEach(el => el.remove());
    };
  }, [localStream, addUser, removeUser, handleSignal]);

  return {
    peersCount: peersRef.current.size,
  };
};