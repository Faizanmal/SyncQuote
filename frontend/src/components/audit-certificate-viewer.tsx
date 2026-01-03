'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
    FileCheck2,
    Download,
    Shield,
    Clock,
    MapPin,
    User,
    Eye,
    CheckCircle,
    FileSignature,
    ExternalLink,
} from 'lucide-react';
import { useAuditCertificate } from '@/hooks/use-api';
import { cn } from '@/lib/utils';

interface AuditTrailEntry {
    action: string;
    timestamp: string;
    ipAddress?: string;
    email?: string;
    details?: string;
}

interface CertificateData {
    proposalId: string;
    proposalTitle: string;
    certificateId: string;
    generatedAt: string;
    signedAt: string;
    signerName: string;
    signerEmail: string;
    signatureIpAddress?: string;
    auditTrail: AuditTrailEntry[];
    pdfUrl?: string;
}

interface AuditCertificateViewerProps {
    proposalId: string;
    className?: string;
}

export function AuditCertificateViewer({ proposalId, className }: AuditCertificateViewerProps) {
    const { data, isLoading, error } = useAuditCertificate(proposalId);
    const [downloading, setDownloading] = useState(false);

    const certificate = data?.data as CertificateData | undefined;

    const handleDownload = async () => {
        if (!certificate?.pdfUrl) return;

        setDownloading(true);
        try {
            const link = document.createElement('a');
            link.href = certificate.pdfUrl;
            link.download = `certificate-${certificate.proposalId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            console.error('Failed to download certificate');
        } finally {
            setDownloading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActionIcon = (action: string) => {
        if (action.toLowerCase().includes('created')) return <FileCheck2 className="h-4 w-4 text-blue-500" />;
        if (action.toLowerCase().includes('viewed')) return <Eye className="h-4 w-4 text-amber-500" />;
        if (action.toLowerCase().includes('signed')) return <FileSignature className="h-4 w-4 text-green-500" />;
        if (action.toLowerCase().includes('sent')) return <ExternalLink className="h-4 w-4 text-purple-500" />;
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    };

    if (isLoading) {
        return (
            <Card className={cn("", className)}>
                <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error || !certificate) {
        return (
            <Card className={cn("", className)}>
                <CardContent className="py-8 text-center">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                        {error ? 'Failed to load certificate' : 'No certificate available'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("", className)}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-green-500" />
                            Certificate of Completion
                        </CardTitle>
                        <CardDescription>
                            Digital signature verification & audit trail
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                        {certificate.certificateId}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Signature Summary */}
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <h3 className="font-semibold text-green-800 dark:text-green-200">Document Signed</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-muted-foreground">Signed by</p>
                            <p className="font-medium flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {certificate.signerName}
                            </p>
                            <p className="text-xs text-muted-foreground">{certificate.signerEmail}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">Signed at</p>
                            <p className="font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(certificate.signedAt)}
                            </p>
                            {certificate.signatureIpAddress && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    IP: {certificate.signatureIpAddress}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Audit Trail */}
                <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Audit Trail
                    </h3>
                    <ScrollArea className="h-64 border rounded-lg">
                        <div className="p-4 space-y-3">
                            {certificate.auditTrail.map((entry, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {getActionIcon(entry.action)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-medium text-sm">{entry.action}</p>
                                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(entry.timestamp)}
                                            </p>
                                        </div>
                                        {entry.details && (
                                            <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                            {entry.email && (
                                                <span className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {entry.email}
                                                </span>
                                            )}
                                            {entry.ipAddress && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {entry.ipAddress}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </CardContent>

            <Separator />

            <CardFooter className="pt-4">
                <Button
                    onClick={handleDownload}
                    disabled={downloading || !certificate.pdfUrl}
                    className="w-full"
                >
                    <Download className="h-4 w-4 mr-2" />
                    {downloading ? 'Downloading...' : 'Download Certificate PDF'}
                </Button>
            </CardFooter>
        </Card>
    );
}
