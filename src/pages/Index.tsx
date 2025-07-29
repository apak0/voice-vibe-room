import React, { useState } from 'react';
import { RoomManager } from '@/components/RoomManager';
import { VoiceChat } from '@/components/VoiceChat';

const Index = () => {
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');

  const handleJoinRoom = (roomId: string, userName: string) => {
    setCurrentRoom(roomId);
    setCurrentUser(userName);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    setCurrentUser('');
  };

  if (currentRoom && currentUser) {
    return (
      <VoiceChat 
        roomId={currentRoom}
        userName={currentUser}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return <RoomManager onJoinRoom={handleJoinRoom} />;
};

export default Index;