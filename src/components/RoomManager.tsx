import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Plus, LogIn, Mic, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { LanguageSwitcher } from './LanguageSwitcher';

interface RoomManagerProps {
  onJoinRoom: (roomId: string, userName: string) => void;
}

export const RoomManager: React.FC<RoomManagerProps> = ({ onJoinRoom }) => {
  const { t } = useTranslation();
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const validateInput = () => {
    if (!userName.trim()) {
      toast({
        title: t("Name required"),
        description: t("Please enter your name to continue."),
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
      {/* Language Switcher */}
      <div className="fixed top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <Mic className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('welcome')}</h1>
          <p className="text-muted-foreground">{t('connectFriends')}</p>
        </div>

        {/* User Name Input */}
        <Card className="p-6 mb-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="userName" className="text-foreground">{t('userName')}</Label>
              <Input
                id="userName"
                type="text"
                placeholder={t('enterYourName')}
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="mt-2"
                maxLength={20}
              />
            </div>
          </div>
        </Card>

        {/* Create Room */}
        <Card className="p-6 mb-4">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-foreground">
              <Plus className="w-5 h-5" />
              <h2 className="text-lg font-semibold">{t('createRoom')}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('connectFriends')}
            </p>
            <Button 
              variant="default" 
              size="lg"
              onClick={createRoom}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {t('Creating Room...')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('createRoom')}
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Join Room */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-foreground">
              <LogIn className="w-5 h-5" />
              <h2 className="text-lg font-semibold">{t('joinRoom')}</h2>
            </div>
            <div>
              <Label htmlFor="roomId" className="text-foreground">{t('roomId')}</Label>
              <Input
                id="roomId"
                type="text"
                placeholder={t('enterRoomId')}
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="mt-2"
                maxLength={10}
              />
            </div>
            <Button 
              variant="outline" 
              size="lg"
              onClick={joinRoom}
              className="w-full"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {t('joinRoom')}
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