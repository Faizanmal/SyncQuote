"use client";

import React, { useState, useEffect } from 'react';
import { usePWA } from '@/hooks/use-pwa';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Download,
  X,
  Smartphone,
  Monitor,
  Zap,
  Bell,
  WifiOff,
  CheckCircle,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface PWAInstallPromptProps {
  variant?: 'banner' | 'dialog' | 'button';
}

export function PWAInstallPrompt({ variant = 'banner' }: PWAInstallPromptProps) {
  const { isInstallable, isInstalled, install } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the prompt before
    const dismissedAt = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setDismissed(true);
      }
    }
  }, []);

  const handleInstall = async () => {
    const installed = await install();
    if (installed) {
      toast.success('SyncQuote has been installed!');
    }
    setDialogOpen(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', new Date().toISOString());
  };

  // Don't show if already installed, not installable, or dismissed
  if (isInstalled || !isInstallable || dismissed) {
    if (variant === 'button') {
      return null;
    }
    return null;
  }

  // Button variant
  if (variant === 'button') {
    return (
      <Button onClick={() => setDialogOpen(true)} variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        Install App
      </Button>
    );
  }

  // Dialog variant
  if (variant === 'dialog') {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle>Install SyncQuote</DialogTitle>
                <DialogDescription>Add to your home screen</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Install SyncQuote for a faster, more reliable experience with offline access.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span>Faster loading</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-blue-500" />
                <span>Push notifications</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <WifiOff className="h-4 w-4 text-green-500" />
                <span>Works offline</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Smartphone className="h-4 w-4 text-purple-500" />
                <span>Home screen icon</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Maybe Later
            </Button>
            <Button onClick={handleInstall}>
              <Download className="h-4 w-4 mr-2" />
              Install
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Banner variant (default)
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Install SyncQuote</CardTitle>
                <CardDescription className="text-xs">Get the full app experience</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>Fast</span>
            </div>
            <div className="flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </div>
            <div className="flex items-center gap-1">
              <Bell className="h-3 w-3" />
              <span>Notifications</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" size="sm" onClick={handleInstall}>
              Install
            </Button>
            <Button variant="outline" size="sm" onClick={handleDismiss}>
              Not Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Update prompt component
export function PWAUpdatePrompt() {
  const { isUpdateAvailable, update } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  if (!isUpdateAvailable || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-top-5">
      <Card className="shadow-lg border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Update Available</p>
              <p className="text-xs text-muted-foreground">A new version is ready to install</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={update}>
                Update
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDismissed(true)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Offline indicator component
export function OfflineIndicator() {
  const { isOnline } = usePWA();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {!isOnline ? (
        <div className="bg-yellow-500 text-yellow-950 py-2 px-4 text-center text-sm flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span>You're offline. Changes will sync when you reconnect.</span>
        </div>
      ) : showReconnected ? (
        <div className="bg-green-500 text-white py-2 px-4 text-center text-sm flex items-center justify-center gap-2 animate-in slide-in-from-top-1">
          <CheckCircle className="h-4 w-4" />
          <span>You're back online! Syncing your changes...</span>
        </div>
      ) : null}
    </div>
  );
}

// Combined PWA status component for settings page
export function PWAStatus() {
  const { isInstalled, isInstallable, isOnline, isUpdateAvailable, install, update } = usePWA();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          App Status
        </CardTitle>
        <CardDescription>
          SyncQuote Progressive Web App status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <span>Installation Status</span>
          </div>
          {isInstalled ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Installed
            </Badge>
          ) : isInstallable ? (
            <Button size="sm" onClick={install}>
              <Download className="h-4 w-4 mr-1" />
              Install
            </Button>
          ) : (
            <Badge variant="secondary">Not Available</Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-yellow-500" />
            )}
            <span>Connection Status</span>
          </div>
          <Badge variant={isOnline ? 'default' : 'secondary'}>
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {isUpdateAvailable && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <span>Update Available</span>
            </div>
            <Button size="sm" variant="outline" onClick={update}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Update Now
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PWAInstallPrompt;
