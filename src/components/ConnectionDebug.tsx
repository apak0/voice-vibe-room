import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Wifi, WifiOff } from 'lucide-react';

interface ConnectionDebugProps {
  participants: Array<{
    id: string;
    name: string;
    hasVideo: boolean;
    isMuted: boolean;
    isSpeaking: boolean;
  }>;
  remoteStreams: Map<string, { stream: MediaStream; userName: string }>;
  peersCount: number;
  localStreamActive: boolean;
}

export const ConnectionDebug: React.FC<ConnectionDebugProps> = ({
  participants,
  remoteStreams,
  peersCount,
  localStreamActive
}) => {
  return (
    <Card className="p-4 bg-muted/50 border-2 border-dashed border-border/50">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span className="font-medium">Debug Info</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Participants:</span>
            <span className="ml-2 font-mono">{participants.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Remote Streams:</span>
            <span className="ml-2 font-mono">{remoteStreams.size}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Peer Connections:</span>
            <span className="ml-2 font-mono">{peersCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Local Stream:</span>
            {localStreamActive ? (
              <Badge variant="default" className="text-xs">
                <Wifi className="w-3 h-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                <WifiOff className="w-3 h-3 mr-1" />
                Inactive
              </Badge>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <span className="text-sm font-medium text-muted-foreground">Participants Status:</span>
          <div className="grid gap-1">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs p-2 bg-background rounded">
                <span className="font-mono">{p.name}</span>
                <div className="flex gap-1">
                  <Badge variant={p.hasVideo ? "default" : "outline"} className="text-xs">
                    {p.hasVideo ? "Video" : "No Video"}
                  </Badge>
                  <Badge variant={p.isMuted ? "destructive" : "default"} className="text-xs">
                    {p.isMuted ? "Muted" : "Audio"}
                  </Badge>
                  {p.isSpeaking && (
                    <Badge variant="secondary" className="text-xs animate-pulse">
                      Speaking
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-2">
          <span className="text-sm font-medium text-muted-foreground">Remote Streams:</span>
          <div className="grid gap-1">
            {Array.from(remoteStreams.entries()).map(([userId, streamData]) => (
              <div key={userId} className="flex items-center justify-between text-xs p-2 bg-background rounded">
                <span className="font-mono">{streamData.userName}</span>
                <div className="flex gap-1">
                  <Badge variant="default" className="text-xs">
                    Audio: {streamData.stream.getAudioTracks().length}
                  </Badge>
                  <Badge variant="default" className="text-xs">
                    Video: {streamData.stream.getVideoTracks().length}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};