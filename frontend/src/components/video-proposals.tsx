'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
  Video,
  Play,
  Pause,
  StopCircle,
  Camera,
  Upload,
  Link2,
  BarChart2,
  Eye,
  Clock,
  Users,
  TrendingUp,
  Mic,
  MicOff,
  Monitor,
  Trash2,
  Copy,
  ExternalLink,
  Settings,
  Sparkles,
  UserCircle,
} from 'lucide-react';

interface ProposalVideo {
  id: string;
  proposalId: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  duration: number;
  provider: 'loom' | 'vidyard' | 'custom' | 'recorded';
  position: 'header' | 'inline' | 'sidebar';
  personalized: boolean;
  createdAt: string;
  analytics?: VideoAnalytics;
}

interface VideoAnalytics {
  totalViews: number;
  uniqueViewers: number;
  averageWatchTime: number;
  completionRate: number;
  engagementScore: number;
  viewsByDay: { date: string; views: number }[];
}

interface VideoIntegration {
  id: string;
  provider: 'loom' | 'vidyard';
  connected: boolean;
  accountEmail?: string;
}

export function VideoProposals({ proposalId }: { proposalId?: string }) {
  const [videos, setVideos] = useState<ProposalVideo[]>([]);
  const [integrations, setIntegrations] = useState<VideoIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<ProposalVideo | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const { toast } = useToast();

  // Form state
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [videoPosition, setVideoPosition] = useState<'header' | 'inline' | 'sidebar'>('header');
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    fetchVideos();
    fetchIntegrations();
  }, [proposalId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recording]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/video-proposals${proposalId ? `?proposalId=${proposalId}` : ''}`);
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/video-proposals/integrations');
      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    }
  };

  const connectIntegration = async (provider: string) => {
    try {
      const response = await fetch(`/api/video-proposals/integrations/${provider}/connect`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: 'Failed to connect video integration',
        variant: 'destructive',
      });
    }
  };

  const addVideo = async () => {
    try {
      const response = await fetch('/api/video-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          url: videoUrl,
          title: videoTitle,
          position: videoPosition,
          personalized,
        }),
      });
      const data = await response.json();
      setVideos(prev => [...prev, data.video]);
      setShowAddDialog(false);
      resetForm();
      toast({
        title: 'Video added',
        description: 'Video has been added to the proposal',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add video',
        variant: 'destructive',
      });
    }
  };

  const deleteVideo = async (videoId: string) => {
    try {
      await fetch(`/api/video-proposals/${videoId}`, { method: 'DELETE' });
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast({
        title: 'Video removed',
        description: 'Video has been removed from the proposal',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove video',
        variant: 'destructive',
      });
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: audioEnabled,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        await uploadRecording(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
    } catch (error) {
      toast({
        title: 'Recording failed',
        description: 'Failed to access camera/microphone',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setShowRecordDialog(false);
    }
  };

  const uploadRecording = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('video', blob);
      formData.append('proposalId', proposalId || '');
      formData.append('title', `Recording ${new Date().toLocaleDateString()}`);

      const response = await fetch('/api/video-proposals/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setVideos(prev => [...prev, data.video]);
      toast({
        title: 'Recording saved',
        description: 'Your video recording has been saved',
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload recording',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setVideoUrl('');
    setVideoTitle('');
    setVideoPosition('header');
    setPersonalized(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      loom: 'bg-purple-500',
      vidyard: 'bg-green-500',
      custom: 'bg-gray-500',
      recorded: 'bg-blue-500',
    };
    return <Badge className={colors[provider] || 'bg-gray-500'}>{provider}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Video Proposals</h2>
          <p className="text-muted-foreground">Add personalized video messages to your proposals</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Record
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Record Video</DialogTitle>
                <DialogDescription>Record a personalized video message for your proposal</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {recording && (
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-white font-mono">{formatDuration(recordingTime)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAudioEnabled(!audioEnabled)}
                    >
                      {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {audioEnabled ? 'Mic on' : 'Mic off'}
                    </span>
                  </div>
                  {!recording ? (
                    <Button onClick={startRecording}>
                      <Video className="w-4 h-4 mr-2" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={stopRecording}>
                      <StopCircle className="w-4 h-4 mr-2" />
                      Stop Recording
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Link2 className="w-4 h-4 mr-2" />
                Add Video
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Video</DialogTitle>
                <DialogDescription>Add a video from Loom, Vidyard, or any URL</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Video URL</Label>
                  <Input
                    placeholder="https://www.loom.com/share/..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title (optional)</Label>
                  <Input
                    placeholder="Introduction video"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select value={videoPosition} onValueChange={(v: 'header' | 'inline' | 'sidebar') => setVideoPosition(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="header">Header (Top of proposal)</SelectItem>
                      <SelectItem value="inline">Inline (Within content)</SelectItem>
                      <SelectItem value="sidebar">Sidebar (Fixed position)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Personalized Video</Label>
                    <p className="text-sm text-muted-foreground">Show viewer's name overlay</p>
                  </div>
                  <Switch checked={personalized} onCheckedChange={setPersonalized} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button onClick={addVideo} disabled={!videoUrl}>Add Video</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Connected Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { id: 'loom', name: 'Loom', icon: Video, color: '#625DF5' },
          { id: 'vidyard', name: 'Vidyard', icon: Camera, color: '#0FA86D' },
        ].map((provider) => {
          const integration = integrations.find(i => i.provider === provider.id);
          const connected = integration?.connected;
          return (
            <Card key={provider.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${provider.color}20` }}>
                    <provider.icon className="w-5 h-5" style={{ color: provider.color }} />
                  </div>
                  <div>
                    <h4 className="font-medium">{provider.name}</h4>
                    {connected ? (
                      <p className="text-sm text-muted-foreground">{integration?.accountEmail}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not connected</p>
                    )}
                  </div>
                </div>
                {connected ? (
                  <Badge className="bg-green-500">Connected</Badge>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => connectIntegration(provider.id)}>
                    Connect
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Videos List */}
      <Tabs defaultValue="videos">
        <TabsList>
          <TabsTrigger value="videos">
            <Video className="w-4 h-4 mr-2" />
            Videos ({videos.length})
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart2 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <Card key={video.id} className="overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                    <Button size="lg" variant="secondary" className="rounded-full">
                      <Play className="w-6 h-6" />
                    </Button>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="font-mono">
                      {formatDuration(video.duration)}
                    </Badge>
                  </div>
                  {video.personalized && (
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Personalized
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium line-clamp-1">{video.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {getProviderBadge(video.provider)}
                        <Badge variant="outline">{video.position}</Badge>
                      </div>
                    </div>
                  </div>
                  {video.analytics && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                      <div className="text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Eye className="w-3 h-3" /> Views
                        </div>
                        <span className="font-medium">{video.analytics.totalViews}</span>
                      </div>
                      <div className="text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3 h-3" /> Avg Watch
                        </div>
                        <span className="font-medium">{Math.round(video.analytics.averageWatchTime)}s</span>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="p-4 pt-0 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Copy className="w-4 h-4 mr-1" />
                    Copy Link
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteVideo(video.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </CardFooter>
              </Card>
            ))}

            {videos.length === 0 && !loading && (
              <Card className="col-span-full border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Video className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No Videos Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Add a video to make your proposal stand out</p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowRecordDialog(true)}>
                      <Camera className="w-4 h-4 mr-2" />
                      Record
                    </Button>
                    <Button onClick={() => setShowAddDialog(true)}>
                      <Link2 className="w-4 h-4 mr-2" />
                      Add Video
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">Total Views</span>
                </div>
                <p className="text-2xl font-bold">
                  {videos.reduce((sum, v) => sum + (v.analytics?.totalViews || 0), 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Unique Viewers</span>
                </div>
                <p className="text-2xl font-bold">
                  {videos.reduce((sum, v) => sum + (v.analytics?.uniqueViewers || 0), 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Avg Watch Time</span>
                </div>
                <p className="text-2xl font-bold">
                  {Math.round(
                    videos.reduce((sum, v) => sum + (v.analytics?.averageWatchTime || 0), 0) / videos.length || 0
                  )}s
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Completion Rate</span>
                </div>
                <p className="text-2xl font-bold">
                  {Math.round(
                    videos.reduce((sum, v) => sum + (v.analytics?.completionRate || 0), 0) / videos.length || 0
                  )}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Video Performance</CardTitle>
              <CardDescription>View analytics for each video</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-4">
                  {videos.map((video) => (
                    <div key={video.id} className="flex items-center gap-4 pb-4 border-b last:border-0">
                      <div className="w-24 h-14 bg-muted rounded overflow-hidden flex-shrink-0">
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{video.title}</h4>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Eye className="w-3 h-3" /> {video.analytics?.totalViews || 0}
                          </span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {video.analytics?.averageWatchTime || 0}s
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {video.analytics?.completionRate || 0}% completed
                          </span>
                        </div>
                      </div>
                      <div className="w-32">
                        <Progress value={video.analytics?.completionRate || 0} />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
