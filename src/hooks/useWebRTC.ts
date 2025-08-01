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
      playRemoteAudio(remoteStream, remoteUserId);
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

  const playRemoteAudio = useCallback((stream: MediaStream, userId: string) => {
    // Create or update audio element for this user
    let audioElement = document.getElementById(`audio-${userId}`) as HTMLAudioElement;
    
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = `audio-${userId}`;
      audioElement.autoplay = true;
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);
    }

    audioElement.srcObject = stream;
    audioElement.play().catch(console.error);
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

      // Remove audio element
      const audioElement = document.getElementById(`audio-${leftUserId}`);
      if (audioElement) {
        audioElement.remove();
      }
    }
  }, []);

  useEffect(() => {
    const socket = socketRef.current;

    // Join room
    socketService.joinRoom(roomId, userId, userName);

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

      // Remove audio elements
      document.querySelectorAll('[id^="audio-"]').forEach(el => el.remove());

      // Leave room
      socketService.leaveRoom(roomId, userId);
    };
  }, [roomId, userId, addUser, removeUser, handleSignal]);

  return {
    peersCount: peersRef.current.size,
  };
};