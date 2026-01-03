'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Globe,
    Wand2,
    Sparkles,
    Loader2,
    Copy,
    Check,
    Building,
    Palette,
    MessageSquare,
    ArrowRight,
    RefreshCw,
} from 'lucide-react';
import { useDraftFromUrl, useSmartRewrite } from '@/hooks/use-api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AIContentDrafterProps {
    onInsert?: (content: string) => void;
    proposalId?: string;
    className?: string;
}

const blockTypes = [
    { value: 'introduction', label: 'Introduction' },
    { value: 'scope', label: 'Scope of Work' },
    { value: 'terms', label: 'Terms & Conditions' },
    { value: 'pricing', label: 'Pricing Section' },
    { value: 'conclusion', label: 'Conclusion' },
    { value: 'custom', label: 'Custom Block' },
] as const;

const rewriteStyles = [
    { value: 'persuasive', label: 'More Persuasive', icon: '🎯' },
    { value: 'concise', label: 'More Concise', icon: '✂️' },
    { value: 'professional', label: 'More Professional', icon: '👔' },
    { value: 'friendly', label: 'More Friendly', icon: '😊' },
    { value: 'formal', label: 'More Formal', icon: '📜' },
    { value: 'simplified', label: 'Simplified', icon: '💡' },
] as const;

export function AIContentDrafter({ onInsert, proposalId, className }: AIContentDrafterProps) {
    // URL Drafter State
    const [url, setUrl] = useState('');
    const [blockType, setBlockType] = useState<typeof blockTypes[number]['value']>('introduction');
    const [additionalContext, setAdditionalContext] = useState('');
    const [serviceType, setServiceType] = useState('');
    const [urlResult, setUrlResult] = useState<{
        content: string;
        companyName?: string;
        detectedTone?: string;
        keyThemes?: string[];
        industry?: string;
    } | null>(null);

    // Smart Rewrite State
    const [originalContent, setOriginalContent] = useState('');
    const [rewriteInstruction, setRewriteInstruction] = useState('');
    const [rewriteStyle, setRewriteStyle] = useState<typeof rewriteStyles[number]['value'] | ''>('');
    const [rewriteResult, setRewriteResult] = useState<{
        rewrittenContent: string;
        explanation?: string;
        suggestions?: string[];
    } | null>(null);

    const [copied, setCopied] = useState<'url' | 'rewrite' | null>(null);

    const draftFromUrl = useDraftFromUrl();
    const smartRewrite = useSmartRewrite();

    const handleDraftFromUrl = async () => {
        if (!url) {
            toast.error('Please enter a URL');
            return;
        }

        try {
            const result = await draftFromUrl.mutateAsync({
                url,
                blockType,
                additionalContext: additionalContext || undefined,
                proposalId,
                serviceType: serviceType || undefined,
            });
            setUrlResult(result.data);
            toast.success('Content generated successfully!');
        } catch {
            toast.error('Failed to generate content from URL');
        }
    };

    const handleSmartRewrite = async () => {
        if (!originalContent) {
            toast.error('Please enter content to rewrite');
            return;
        }
        if (!rewriteInstruction && !rewriteStyle) {
            toast.error('Please provide an instruction or select a style');
            return;
        }

        try {
            const instruction = rewriteInstruction || `Make this ${rewriteStyle}`;
            const result = await smartRewrite.mutateAsync({
                content: originalContent,
                instruction,
                style: rewriteStyle || undefined,
            });
            setRewriteResult(result.data);
            toast.success('Content rewritten successfully!');
        } catch {
            toast.error('Failed to rewrite content');
        }
    };

    const handleCopy = async (content: string, type: 'url' | 'rewrite') => {
        await navigator.clipboard.writeText(content);
        setCopied(type);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(null), 2000);
    };

    const handleInsert = (content: string) => {
        onInsert?.(content);
        toast.success('Content inserted');
    };

    return (
        <Card className={cn("", className)}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    AI Content Drafter
                </CardTitle>
                <CardDescription>
                    Generate personalized content from URLs or rewrite existing text
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="url" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="url" className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Draft from URL
                        </TabsTrigger>
                        <TabsTrigger value="rewrite" className="flex items-center gap-2">
                            <Wand2 className="h-4 w-4" />
                            Smart Rewrite
                        </TabsTrigger>
                    </TabsList>

                    {/* Draft from URL Tab */}
                    <TabsContent value="url" className="space-y-4">
                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="url">Client Website URL</Label>
                                <Input
                                    id="url"
                                    type="url"
                                    placeholder="https://example.com"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Block Type</Label>
                                    <Select value={blockType} onValueChange={(v) => setBlockType(v as any)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {blockTypes.map((type) => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Service Type</Label>
                                    <Input
                                        placeholder="e.g., Web Design"
                                        value={serviceType}
                                        onChange={(e) => setServiceType(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Additional Context (optional)</Label>
                                <Textarea
                                    placeholder="Any specific requirements or notes..."
                                    value={additionalContext}
                                    onChange={(e) => setAdditionalContext(e.target.value)}
                                    rows={2}
                                />
                            </div>

                            <Button
                                onClick={handleDraftFromUrl}
                                disabled={draftFromUrl.isPending}
                                className="w-full"
                            >
                                {draftFromUrl.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Analyzing website...
                                    </>
                                ) : (
                                    <>
                                        <Globe className="h-4 w-4 mr-2" />
                                        Generate Content
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* URL Result */}
                        {urlResult && (
                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex flex-wrap gap-2">
                                    {urlResult.companyName && (
                                        <Badge variant="secondary" className="flex items-center gap-1">
                                            <Building className="h-3 w-3" />
                                            {urlResult.companyName}
                                        </Badge>
                                    )}
                                    {urlResult.industry && (
                                        <Badge variant="outline">{urlResult.industry}</Badge>
                                    )}
                                    {urlResult.detectedTone && (
                                        <Badge variant="outline" className="flex items-center gap-1">
                                            <Palette className="h-3 w-3" />
                                            {urlResult.detectedTone}
                                        </Badge>
                                    )}
                                </div>

                                {urlResult.keyThemes && urlResult.keyThemes.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        <span className="text-xs text-muted-foreground mr-1">Themes:</span>
                                        {urlResult.keyThemes.map((theme, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs">
                                                {theme}
                                            </Badge>
                                        ))}
                                    </div>
                                )}

                                <ScrollArea className="h-48 border rounded-lg p-3 bg-muted/30">
                                    <p className="text-sm whitespace-pre-wrap">{urlResult.content}</p>
                                </ScrollArea>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopy(urlResult.content, 'url')}
                                    >
                                        {copied === 'url' ? (
                                            <Check className="h-4 w-4 mr-1" />
                                        ) : (
                                            <Copy className="h-4 w-4 mr-1" />
                                        )}
                                        Copy
                                    </Button>
                                    {onInsert && (
                                        <Button size="sm" onClick={() => handleInsert(urlResult.content)}>
                                            <ArrowRight className="h-4 w-4 mr-1" />
                                            Insert
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* Smart Rewrite Tab */}
                    <TabsContent value="rewrite" className="space-y-4">
                        <div className="space-y-3">
                            <div>
                                <Label>Original Content</Label>
                                <Textarea
                                    placeholder="Paste the content you want to rewrite..."
                                    value={originalContent}
                                    onChange={(e) => setOriginalContent(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            <div>
                                <Label>Quick Styles</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {rewriteStyles.map((style) => (
                                        <Button
                                            key={style.value}
                                            variant={rewriteStyle === style.value ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setRewriteStyle(style.value)}
                                        >
                                            <span className="mr-1">{style.icon}</span>
                                            {style.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label>Custom Instruction (optional)</Label>
                                <Input
                                    placeholder="e.g., Make it more persuasive and add urgency"
                                    value={rewriteInstruction}
                                    onChange={(e) => setRewriteInstruction(e.target.value)}
                                />
                            </div>

                            <Button
                                onClick={handleSmartRewrite}
                                disabled={smartRewrite.isPending}
                                className="w-full"
                            >
                                {smartRewrite.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Rewriting...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-4 w-4 mr-2" />
                                        Rewrite Content
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Rewrite Result */}
                        {rewriteResult && (
                            <div className="space-y-3 pt-4 border-t">
                                <ScrollArea className="h-48 border rounded-lg p-3 bg-muted/30">
                                    <p className="text-sm whitespace-pre-wrap">{rewriteResult.rewrittenContent}</p>
                                </ScrollArea>

                                {rewriteResult.explanation && (
                                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                                        <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5" />
                                        <p className="text-blue-700 dark:text-blue-300">{rewriteResult.explanation}</p>
                                    </div>
                                )}

                                {rewriteResult.suggestions && rewriteResult.suggestions.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-muted-foreground">Suggestions for improvement:</p>
                                        <ul className="text-xs space-y-1">
                                            {rewriteResult.suggestions.map((suggestion, i) => (
                                                <li key={i} className="flex items-start gap-1">
                                                    <span className="text-muted-foreground">•</span>
                                                    {suggestion}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopy(rewriteResult.rewrittenContent, 'rewrite')}
                                    >
                                        {copied === 'rewrite' ? (
                                            <Check className="h-4 w-4 mr-1" />
                                        ) : (
                                            <Copy className="h-4 w-4 mr-1" />
                                        )}
                                        Copy
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setOriginalContent(rewriteResult.rewrittenContent);
                                            setRewriteResult(null);
                                        }}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-1" />
                                        Iterate
                                    </Button>
                                    {onInsert && (
                                        <Button size="sm" onClick={() => handleInsert(rewriteResult.rewrittenContent)}>
                                            <ArrowRight className="h-4 w-4 mr-1" />
                                            Insert
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
