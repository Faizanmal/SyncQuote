'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Eye,
    Users,
    MousePointer2,
    Clock,
    Bell,
    X,
    MapPin,
    Activity,
} from 'lucide-react';
import { useSocket } from '@/hooks/use-socket';
import { cn } from '@/lib/utils';

interface CoBrowsingOverlayProps {
    proposalId: string;
    userId: string;
    className?: string;
    minimized?: boolean;
    onMinimizeChange?: (minimized: boolean) => void;
}

export function CoBrowsingOverlay({
    proposalId,
    userId,
    className,
    minimized = false,
    onMinimizeChange,
}: CoBrowsingOverlayProps) {
    const {
        isConnected,
        viewers,
        lingerAlerts,
        clearLingerAlerts
    } = useSocket({ proposalId, userId });

    const [isMinimized, setIsMinimized] = useState(minimized);

    useEffect(() => {
        setIsMinimized(minimized);
    }, [minimized]);

    const handleMinimize = () => {
        const newState = !isMinimized;
        setIsMinimized(newState);
        onMinimizeChange?.(newState);
    };

    if (!isConnected) {
        return null;
    }

    const activeViewers = viewers.length;

    if (isMinimized) {
        return (
            <Button
                variant="outline"
                size="sm"
                className={cn(
                    "fixed bottom-4 right-4 shadow-lg z-50",
                    activeViewers > 0 && "animate-pulse bg-green-50 border-green-500",
                    className
                )}
                onClick={handleMinimize}
            >
                <Eye className="h-4 w-4 mr-2" />
                {activeViewers} viewing
                {lingerAlerts.length > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                        {lingerAlerts.length}
                    </Badge>
                )}
            </Button>
        );
    }

    return (
        <Card className={cn("fixed bottom-4 right-4 w-80 shadow-xl z-50", className)}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4 text-green-500" />
                        Live Co-Browsing
                    </CardTitle>
                    <div className="flex items-center gap-1">
                        <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
                            {isConnected ? 'Live' : 'Offline'}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleMinimize}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Active Viewers */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Active Viewers ({activeViewers})</span>
                    </div>

                    {activeViewers === 0 ? (
                        <p className="text-xs text-muted-foreground">No one is viewing right now</p>
                    ) : (
                        <ScrollArea className="h-32">
                            <div className="space-y-2">
                                {viewers.map((viewer) => (
                                    <div
                                        key={viewer.socketId}
                                        className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            <div>
                                                <p className="text-xs font-medium">
                                                    {viewer.viewerName || viewer.viewerEmail || 'Anonymous'}
                                                </p>
                                                {viewer.activeSection && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {viewer.activeSection}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Progress value={viewer.scrollDepth} className="w-12 h-1.5" />
                                            <p className="text-xs text-muted-foreground">{viewer.scrollDepth}%</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                {/* Linger Alerts */}
                {lingerAlerts.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4 text-amber-500" />
                                <span className="text-sm font-medium">Interest Alerts</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={clearLingerAlerts}
                            >
                                Clear
                            </Button>
                        </div>
                        <ScrollArea className="h-24">
                            <div className="space-y-1">
                                {lingerAlerts.map((alert, index) => (
                                    <div
                                        key={`${alert.sectionId}-${index}`}
                                        className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800"
                                    >
                                        <Clock className="h-3 w-3 text-amber-500 mt-0.5" />
                                        <div>
                                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                                Viewer spending time on <strong>{alert.sectionName}</strong>
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(alert.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Cursor overlay for showing remote cursor positions (optional advanced feature)
export function CursorOverlay({ cursors }: { cursors: Array<{ socketId: string; x: number; y: number }> }) {
    return (
        <div className="fixed inset-0 pointer-events-none z-[100]">
            {cursors.map((cursor) => (
                <div
                    key={cursor.socketId}
                    className="absolute transition-all duration-75"
                    style={{ left: cursor.x, top: cursor.y }}
                >
                    <MousePointer2 className="h-4 w-4 text-blue-500" />
                </div>
            ))}
        </div>
    );
}
