'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

interface ViewerPresence {
    socketId: string;
    viewerName?: string;
    viewerEmail?: string;
    scrollDepth: number;
    activeSection?: string;
    lastActivity: Date;
}

interface CursorPosition {
    socketId: string;
    x: number;
    y: number;
    timestamp: Date;
}

interface SectionLinger {
    proposalId: string;
    socketId: string;
    sectionId: string;
    sectionName: string;
    lingerDurationMs: number;
    message: string;
    timestamp: Date;
}

interface UseSocketOptions {
    proposalId?: string;
    userId?: string;
    autoConnect?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
    const { proposalId, userId, autoConnect = true } = options;
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [viewers, setViewers] = useState<ViewerPresence[]>([]);
    const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
    const [lingerAlerts, setLingerAlerts] = useState<SectionLinger[]>([]);

    // Initialize socket connection
    useEffect(() => {
        if (!autoConnect) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            console.log('Socket connected:', socket.id);

            // Join user room for notifications
            if (userId) {
                socket.emit('join_user', { userId });
            }

            // Join proposal room if specified
            if (proposalId) {
                socket.emit('join_proposal', { proposalId });
            }
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('Socket disconnected');
        });

        // Viewer presence updates
        socket.on('viewer_presence', (data: { proposalId: string; viewers: ViewerPresence[] }) => {
            setViewers(data.viewers);
        });

        // Cursor position updates
        socket.on('viewer_cursor', (data: CursorPosition) => {
            setCursors(prev => new Map(prev).set(data.socketId, data));
        });

        // Section linger notifications
        socket.on('section_linger', (data: SectionLinger) => {
            setLingerAlerts(prev => [...prev.slice(-4), data]); // Keep last 5 alerts
        });

        // Viewer left
        socket.on('viewer_left', (data: { proposalId: string; socketId: string }) => {
            setViewers(prev => prev.filter(v => v.socketId !== data.socketId));
            setCursors(prev => {
                const newMap = new Map(prev);
                newMap.delete(data.socketId);
                return newMap;
            });
        });

        // Pricing updates (for owner)
        socket.on('pricing_updated', (data: { proposalId: string; total: number }) => {
            console.log('Pricing updated:', data);
            // This can be handled by React Query invalidation
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [autoConnect, proposalId, userId]);

    // Send presence update (for viewers)
    const sendPresenceUpdate = useCallback((data: {
        scrollDepth: number;
        scrollPosition?: number;
        activeSection?: string;
        activeSectionId?: string;
        viewerName?: string;
        viewerEmail?: string;
    }) => {
        if (socketRef.current && proposalId) {
            socketRef.current.emit('presence_update', { proposalId, ...data });
        }
    }, [proposalId]);

    // Send cursor position (for viewers)
    const sendCursorMove = useCallback((x: number, y: number) => {
        if (socketRef.current && proposalId) {
            socketRef.current.emit('cursor_move', { proposalId, x, y });
        }
    }, [proposalId]);

    // Join a proposal room
    const joinProposal = useCallback((id: string) => {
        if (socketRef.current) {
            socketRef.current.emit('join_proposal', { proposalId: id });
        }
    }, []);

    // Leave a proposal room
    const leaveProposal = useCallback((id: string) => {
        if (socketRef.current) {
            socketRef.current.emit('leave_proposal', { proposalId: id });
        }
    }, []);

    // Clear linger alerts
    const clearLingerAlerts = useCallback(() => {
        setLingerAlerts([]);
    }, []);

    return {
        socket: socketRef.current,
        isConnected,
        viewers,
        cursors: Array.from(cursors.values()),
        lingerAlerts,
        sendPresenceUpdate,
        sendCursorMove,
        joinProposal,
        leaveProposal,
        clearLingerAlerts,
    };
}

// Hook for tracking scroll and section visibility on public proposal pages
export function usePresenceTracking(proposalId: string | null, viewerInfo?: { name?: string; email?: string }) {
    const { sendPresenceUpdate, sendCursorMove } = useSocket({
        proposalId: proposalId || undefined,
        autoConnect: !!proposalId
    });

    // Track scroll position
    useEffect(() => {
        if (!proposalId) return;

        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollDepth = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

            // Find active section
            const sections = document.querySelectorAll('[data-section-id]');
            let activeSection: string | undefined;
            let activeSectionId: string | undefined;

            sections.forEach((section) => {
                const rect = section.getBoundingClientRect();
                if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
                    activeSection = section.getAttribute('data-section-name') || undefined;
                    activeSectionId = section.getAttribute('data-section-id') || undefined;
                }
            });

            sendPresenceUpdate({
                scrollDepth,
                scrollPosition: scrollTop,
                activeSection,
                activeSectionId,
                viewerName: viewerInfo?.name,
                viewerEmail: viewerInfo?.email,
            });
        };

        // Throttle scroll events
        let ticking = false;
        const throttledScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', throttledScroll, { passive: true });
        return () => window.removeEventListener('scroll', throttledScroll);
    }, [proposalId, sendPresenceUpdate, viewerInfo]);

    // Track cursor position
    useEffect(() => {
        if (!proposalId) return;

        let lastSend = 0;
        const throttleMs = 50; // Send cursor updates every 50ms at most

        const handleMouseMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastSend > throttleMs) {
                sendCursorMove(e.clientX, e.clientY);
                lastSend = now;
            }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [proposalId, sendCursorMove]);
}
