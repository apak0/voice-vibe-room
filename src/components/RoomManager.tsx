import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Plus, LogIn, Mic, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

interface RoomManagerProps {
  onJoinRoom: (roomId: string, userName: string) => void;
}

export const RoomManager: React.FC<RoomManagerProps> = ({ onJoinRoom }) => {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const validateInput = () => {
    if (!userName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to continue.",
        variant: "destructive"
      });
      return false;
    }
    return true;
  };

  const createRoom = () => {
    if (!validateInput()) return;
    
    setIsCreating(true);
    const newRoomId = uuidv4().slice(0, 8).toUpperCase();
    
    setTimeout(() => {
      setIsCreating(false);
      onJoinRoom(newRoomId, userName.trim());
      toast({
        title: "Room created!",
        description: `Room ID: ${newRoomId}`,
      });
    }, 1000);
  };

  const joinRoom = () => {
    if (!validateInput()) return;
    
    if (!roomId.trim()) {
      toast({
        title: "Room ID required",
        description: "Please enter a room ID to join.",
        variant: "destructive"
      });
      return;
    }

    onJoinRoom(roomId.trim().toUpperCase(), userName.trim());
    toast({
      title: "Joining room...",
      description: `Connecting to room: ${roomId.trim().toUpperCase()}`,
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-full mb-4 shadow-glow-primary">
            <Mic className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Voice Chat</h1>
          <p className="text-muted-foreground">Connect with friends in crystal clear audio</p>
        </div>

        {/* User Name Input */}
        <Card className="bg-gradient-glass backdrop-blur-md border-white/20 p-6 mb-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="userName" className="text-foreground">Your Name</Label>
              <Input
                id="userName"
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="mt-2 bg-background/50 border-white/20"
                maxLength={20}
              />
            </div>
          </div>
        </Card>

        {/* Create Room */}
        <Card className="bg-gradient-glass backdrop-blur-md border-white/20 p-6 mb-4">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-foreground">
              <Plus className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Create New Room</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Start a new voice chat room and invite friends
            </p>
            <Button 
              variant="voice" 
              size="lg" 
              onClick={createRoom}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating Room...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Room
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Join Room */}
        <Card className="bg-gradient-glass backdrop-blur-md border-white/20 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-foreground">
              <LogIn className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Join Existing Room</h2>
            </div>
            <div>
              <Label htmlFor="roomId" className="text-foreground">Room ID</Label>
              <Input
                id="roomId"
                type="text"
                placeholder="Enter room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="mt-2 bg-background/50 border-white/20"
                maxLength={10}
              />
            </div>
            <Button 
              variant="glass" 
              size="lg" 
              onClick={joinRoom}
              className="w-full"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Join Room
            </Button>
          </div>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-center">
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent/20 rounded-full">
              <Mic className="w-5 h-5 text-accent" />
            </div>
            <p className="text-sm text-muted-foreground">Crystal Clear Audio</p>
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent/20 rounded-full">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <p className="text-sm text-muted-foreground">Multiple Participants</p>
          </div>
        </div>
      </div>
    </div>
  );
};