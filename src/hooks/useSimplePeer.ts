import { useRef, useCallback, useEffect, useState } from 'react';
import SimplePeer from 'simple-peer';
import { socketService } from '@/services/socketService';

interface PeerConnection {
  peer: SimplePeer.Instance;
  userId: string;
  userName: string;
}

export const useSimplePeer = (roomId: string, userId: string, userName: string, localStream: MediaStream | null) => {
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, { stream: MediaStream; userName: string }>>(new Map());

  const createPeer = useCallback((remoteUserId: string, remoteUserName: string, initiator: boolean) => {
    console.log(`Creating peer connection with ${remoteUserName} (${remoteUserId}), initiator: ${initiator}`);
    
    if (!localStream) {
      console.error('Cannot create peer without local stream');
      return null;
    }

    console.log('Local stream tracks:', {
      audio: localStream.getAudioTracks().length,
      video: localStream.getVideoTracks().length,
      videoEnabled: localStream.getVideoTracks()[0]?.enabled
    });
    
    const peerConfig: SimplePeer.Options = {
      initiator,
      trickle: false,
      stream: localStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
    };
    
    const peer = new SimplePeer(peerConfig);

    // Handle signaling data
    peer.on('signal', (data) => {
      console.log(`Sending signal to ${remoteUserId}:`, data.type);
      socketService.sendSignal(roomId, {
        signal: data,
        fromUserId: userId,
        fromUserName: userName,
      }, remoteUserId);
    });

    // Handle incoming stream
    peer.on('stream', (stream) => {
      console.log(`Received stream from ${remoteUserName} (${remoteUserId})`);
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.set(remoteUserId, { stream, userName: remoteUserName });
        return newStreams;
      });
    });

    // Handle connection events
    peer.on('connect', () => {
      console.log(`Connected to ${remoteUserName} (${remoteUserId})`);
    });

    peer.on('close', () => {
      console.log(`Connection closed with ${remoteUserName} (${remoteUserId})`);
      peersRef.current.delete(remoteUserId);
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(remoteUserId);
        return newStreams;
      });
    });

    peer.on('error', (error) => {
      console.error(`Peer error with ${remoteUserName} (${remoteUserId}):`, error);
    });

    // Store peer connection
    peersRef.current.set(remoteUserId, { peer, userId: remoteUserId, userName: remoteUserName });

    return peer;
  }, [roomId, userId, userName, localStream]);

  // Function to recreate peer connections when stream changes
  const recreatePeerConnections = useCallback(() => {
    if (!localStream) return;
    
    console.log('Recreating peer connections with updated stream');
    const existingPeers = Array.from(peersRef.current.entries());
    
    // Destroy all existing peers
    existingPeers.forEach(([peerId, peerConnection]) => {
      peerConnection.peer.destroy();
    });
    peersRef.current.clear();
    
    // Recreate peers with new stream
    existingPeers.forEach(([peerId, peerConnection]) => {
      createPeer(peerId, peerConnection.userName, true);
    });
  }, [localStream, createPeer]);

  // Handle incoming signals
  const handleSignal = useCallback((data: { signal: any; fromUserId: string; fromUserName: string }) => {
    const { signal, fromUserId, fromUserName } = data;
    console.log(`Received signal from ${fromUserName} (${fromUserId}):`, signal.type);

    let peerConnection = peersRef.current.get(fromUserId);

    if (!peerConnection) {
      // Create peer as non-initiator (answerer)
      console.log(`Creating answerer peer for ${fromUserName} (${fromUserId})`);
      const peer = createPeer(fromUserId, fromUserName, false);
      peerConnection = peersRef.current.get(fromUserId);
    }

    if (peerConnection) {
      try {
        peerConnection.peer.signal(signal);
      } catch (error) {
        console.error(`Error processing signal from ${fromUserName}:`, error);
      }
    }
  }, [createPeer]);

  // Handle user joining
  const addUser = useCallback((data: { userId: string; userName: string }) => {
    if (data.userId !== userId && !peersRef.current.has(data.userId)) {
      console.log(`User joined: ${data.userName} (${data.userId})`);
      if (!localStream) {
        console.log('Waiting for local stream before creating peer...');
        return;
      }
      // Create peer as initiator (caller)
      createPeer(data.userId, data.userName, true);
    }
  }, [userId, createPeer, localStream]);

  // Handle user leaving
  const removeUser = useCallback((leftUserId: string) => {
    console.log(`User left: ${leftUserId}`);
    const peerConnection = peersRef.current.get(leftUserId);
    if (peerConnection) {
      peerConnection.peer.destroy();
      peersRef.current.delete(leftUserId);
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(leftUserId);
        return newStreams;
      });
    }
  }, []);

  // Update stream for existing peers
  const updateStream = useCallback((newStream: MediaStream | null) => {
    console.log('Updating stream for all peers:', {
      peersCount: peersRef.current.size,
      hasNewStream: !!newStream,
      streamTracks: newStream ? {
        audio: newStream.getAudioTracks().length,
        video: newStream.getVideoTracks().length
      } : null
    });

    peersRef.current.forEach((peerConnection) => {
      try {
        const peer = peerConnection.peer;
        
        // Remove old tracks
        if (peer._pc && peer._pc.getSenders) {
          peer._pc.getSenders().forEach((sender: RTCRtpSender) => {
            if (sender.track) {
              peer._pc.removeTrack(sender);
            }
          });
        }
        
        // Add new stream tracks
        if (newStream && peer._pc) {
          newStream.getTracks().forEach((track) => {
            peer._pc.addTrack(track, newStream);
          });
        }
      } catch (error) {
        console.error(`Error updating stream for peer ${peerConnection.userId}:`, error);
      }
    });
  }, []);

  // Effect to handle stream changes
  useEffect(() => {
    if (peersRef.current.size > 0) {
      updateStream(localStream);
    }
  }, [localStream, updateStream]);

  // Setup socket listeners
  useEffect(() => {
    if (!localStream) {
      console.log('SimplePeer: Waiting for local stream...');
      return;
    }

    console.log('SimplePeer: Setting up with local stream');

    // Set up event listeners
    socketService.onUserJoined(addUser);
    socketService.onUserLeft(removeUser);
    socketService.onSignal(handleSignal);

    return () => {
      // Clean up all peer connections
      peersRef.current.forEach((peerConnection) => {
        peerConnection.peer.destroy();
      });
      peersRef.current.clear();
      setRemoteStreams(new Map());
    };
  }, [localStream, addUser, removeUser, handleSignal]);

  return {
    remoteStreams,
    peersCount: peersRef.current.size,
  };
};