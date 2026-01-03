'use client';

import { useState, useEffect } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
  Globe,
  Languages,
  DollarSign,
  Check,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Copy,
  ChevronRight,
  ArrowLeftRight,
  Settings,
  Clock,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Type,
  AlignLeft,
  AlignRight,
} from 'lucide-react';

interface Translation {
  id: string;
  proposalId: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  provider: 'google' | 'deepl' | 'azure' | 'openai';
  createdAt: string;
  completedAt?: string;
}

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
}

interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

interface I18nSettings {
  defaultLanguage: string;
  supportedLanguages: string[];
  defaultCurrency: string;
  supportedCurrencies: string[];
  autoDetectLanguage: boolean;
  showLanguageSwitcher: boolean;
  translationProvider: 'google' | 'deepl' | 'azure' | 'openai';
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', rtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', rtl: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', rtl: false },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', rtl: false },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', rtl: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', rtl: false },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', rtl: false },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', rtl: false },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', rtl: true },
];

const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
];

const TRANSLATION_PROVIDERS = [
  { id: 'google', name: 'Google Translate', description: 'Fast and reliable', icon: '🔵' },
  { id: 'deepl', name: 'DeepL', description: 'High quality translations', icon: '🟢' },
  { id: 'azure', name: 'Azure Translator', description: 'Enterprise grade', icon: '🔷' },
  { id: 'openai', name: 'OpenAI GPT', description: 'Context-aware', icon: '🟣' },
];

export function MultiLanguageSettings({ proposalId }: { proposalId?: string }) {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [settings, setSettings] = useState<I18nSettings>({
    defaultLanguage: 'en',
    supportedLanguages: ['en'],
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD'],
    autoDetectLanguage: true,
    showLanguageSwitcher: true,
    translationProvider: 'google',
  });
  const [loading, setLoading] = useState(true);
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const [showCurrencyConverter, setShowCurrencyConverter] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('');
  const [conversionAmount, setConversionAmount] = useState('1000');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchTranslations();
  }, [proposalId]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/i18n/settings');
      const data = await response.json();
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchTranslations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/i18n/translations${proposalId ? `?proposalId=${proposalId}` : ''}`);
      const data = await response.json();
      setTranslations(data.translations || []);
    } catch (error) {
      console.error('Failed to fetch translations:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<I18nSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      await fetch('/api/i18n/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setSettings(updated);
      toast({
        title: 'Settings updated',
        description: 'Language settings have been saved',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    }
  };

  const translateProposal = async () => {
    try {
      const response = await fetch('/api/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          targetLanguage,
          provider: settings.translationProvider,
        }),
      });
      const data = await response.json();
      setTranslations(prev => [...prev, data.translation]);
      setShowTranslateDialog(false);
      setTargetLanguage('');
      toast({
        title: 'Translation started',
        description: `Translating to ${LANGUAGES.find(l => l.code === targetLanguage)?.name}`,
      });
      // Poll for completion
      pollTranslationStatus(data.translation.id);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start translation',
        variant: 'destructive',
      });
    }
  };

  const pollTranslationStatus = (translationId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/i18n/translations/${translationId}`);
        const data = await response.json();
        setTranslations(prev => prev.map(t => (t.id === translationId ? data.translation : t)));
        if (['completed', 'failed'].includes(data.translation.status)) {
          clearInterval(interval);
        }
      } catch (error) {
        clearInterval(interval);
      }
    }, 2000);
  };

  const deleteTranslation = async (translationId: string) => {
    try {
      await fetch(`/api/i18n/translations/${translationId}`, { method: 'DELETE' });
      setTranslations(prev => prev.filter(t => t.id !== translationId));
      toast({
        title: 'Translation deleted',
        description: 'The translation has been removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete translation',
        variant: 'destructive',
      });
    }
  };

  const convertCurrency = async () => {
    try {
      const response = await fetch('/api/i18n/convert-currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(conversionAmount),
          from: fromCurrency,
          to: toCurrency,
        }),
      });
      const data = await response.json();
      setConvertedAmount(data.convertedAmount);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to convert currency',
        variant: 'destructive',
      });
    }
  };

  const toggleLanguage = (languageCode: string) => {
    const newLanguages = settings.supportedLanguages.includes(languageCode)
      ? settings.supportedLanguages.filter(l => l !== languageCode)
      : [...settings.supportedLanguages, languageCode];
    updateSettings({ supportedLanguages: newLanguages });
  };

  const toggleCurrency = (currencyCode: string) => {
    const newCurrencies = settings.supportedCurrencies.includes(currencyCode)
      ? settings.supportedCurrencies.filter(c => c !== currencyCode)
      : [...settings.supportedCurrencies, currencyCode];
    updateSettings({ supportedCurrencies: newCurrencies });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> In Progress</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Multi-Language & Currency</h2>
          <p className="text-muted-foreground">Localize your proposals for global clients</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCurrencyConverter} onOpenChange={setShowCurrencyConverter}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <DollarSign className="w-4 h-4 mr-2" />
                Currency Converter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Currency Converter</DialogTitle>
                <DialogDescription>Convert between currencies using live rates</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={conversionAmount}
                    onChange={(e) => setConversionAmount(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-5 gap-2 items-center">
                  <div className="col-span-2">
                    <Label>From</Label>
                    <Select value={fromCurrency} onValueChange={setFromCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} ({currency.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end justify-center pb-2">
                    <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="col-span-2">
                    <Label>To</Label>
                    <Select value={toCurrency} onValueChange={setToCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} ({currency.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {convertedAmount !== null && (
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Converted Amount</p>
                    <p className="text-2xl font-bold">
                      {CURRENCIES.find(c => c.code === toCurrency)?.symbol}
                      {convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={convertCurrency}>Convert</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {proposalId && (
            <Dialog open={showTranslateDialog} onOpenChange={setShowTranslateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Languages className="w-4 h-4 mr-2" />
                  Translate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Translate Proposal</DialogTitle>
                  <DialogDescription>Select target language for translation</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Target Language</Label>
                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.filter(l => l.code !== settings.defaultLanguage).map((language) => (
                          <SelectItem key={language.code} value={language.code}>
                            <span className="flex items-center gap-2">
                              <span>{language.flag}</span>
                              <span>{language.name}</span>
                              {language.rtl && <Badge variant="outline" className="text-xs">RTL</Badge>}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Translation Provider</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {TRANSLATION_PROVIDERS.map((provider) => (
                        <Button
                          key={provider.id}
                          variant={settings.translationProvider === provider.id ? 'default' : 'outline'}
                          className="justify-start"
                          onClick={() => updateSettings({ translationProvider: provider.id as any })}
                        >
                          <span className="mr-2">{provider.icon}</span>
                          <div className="text-left">
                            <div className="font-medium">{provider.name}</div>
                            <div className="text-xs text-muted-foreground">{provider.description}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTranslateDialog(false)}>Cancel</Button>
                  <Button onClick={translateProposal} disabled={!targetLanguage}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start Translation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="languages">
        <TabsList>
          <TabsTrigger value="languages">
            <Globe className="w-4 h-4 mr-2" />
            Languages
          </TabsTrigger>
          <TabsTrigger value="currencies">
            <DollarSign className="w-4 h-4 mr-2" />
            Currencies
          </TabsTrigger>
          <TabsTrigger value="translations">
            <Languages className="w-4 h-4 mr-2" />
            Translations
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="languages" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Supported Languages</CardTitle>
              <CardDescription>Select which languages your proposals can be displayed in</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {LANGUAGES.map((language) => {
                  const isSelected = settings.supportedLanguages.includes(language.code);
                  const isDefault = settings.defaultLanguage === language.code;
                  return (
                    <div
                      key={language.code}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
                      }`}
                      onClick={() => !isDefault && toggleLanguage(language.code)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{language.flag}</span>
                        <div className="flex gap-1">
                          {language.rtl && (
                            <Badge variant="outline" className="text-xs">
                              <AlignRight className="w-3 h-3 mr-1" />
                              RTL
                            </Badge>
                          )}
                          {isDefault && <Badge>Default</Badge>}
                          {isSelected && !isDefault && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="font-medium">{language.name}</p>
                        <p className="text-sm text-muted-foreground">{language.nativeName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currencies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Supported Currencies</CardTitle>
              <CardDescription>Select which currencies are available for pricing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {CURRENCIES.map((currency) => {
                  const isSelected = settings.supportedCurrencies.includes(currency.code);
                  const isDefault = settings.defaultCurrency === currency.code;
                  return (
                    <div
                      key={currency.code}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
                      }`}
                      onClick={() => !isDefault && toggleCurrency(currency.code)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{currency.symbol}</span>
                        <div className="flex gap-1">
                          {isDefault && <Badge>Default</Badge>}
                          {isSelected && !isDefault && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="font-medium">{currency.code}</p>
                        <p className="text-sm text-muted-foreground">{currency.name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="translations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Translation History</CardTitle>
              <CardDescription>Manage proposal translations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Language</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {translations.map((translation) => {
                    const sourceLang = LANGUAGES.find(l => l.code === translation.sourceLanguage);
                    const targetLang = LANGUAGES.find(l => l.code === translation.targetLanguage);
                    const provider = TRANSLATION_PROVIDERS.find(p => p.id === translation.provider);
                    return (
                      <TableRow key={translation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{sourceLang?.flag}</span>
                            <ChevronRight className="w-4 h-4" />
                            <span>{targetLang?.flag}</span>
                            <span className="font-medium">{targetLang?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <span>{provider?.icon}</span>
                            {provider?.name}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(translation.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={translation.progress} className="w-20 h-2" />
                            <span className="text-sm">{translation.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(translation.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {translation.status === 'completed' && (
                              <Button variant="ghost" size="sm">
                                <Copy className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTranslation(translation.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {translations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        No translations yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Localization Settings</CardTitle>
              <CardDescription>Configure default behavior for language and currency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Language</Label>
                  <Select
                    value={settings.defaultLanguage}
                    onValueChange={(v) => updateSettings({ defaultLanguage: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.filter(l => settings.supportedLanguages.includes(l.code)).map((language) => (
                        <SelectItem key={language.code} value={language.code}>
                          <span className="flex items-center gap-2">
                            <span>{language.flag}</span>
                            <span>{language.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select
                    value={settings.defaultCurrency}
                    onValueChange={(v) => updateSettings({ defaultCurrency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.filter(c => settings.supportedCurrencies.includes(c.code)).map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} ({currency.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Auto-detect Language</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically detect viewer's preferred language
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoDetectLanguage}
                    onCheckedChange={(checked) => updateSettings({ autoDetectLanguage: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Show Language Switcher</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow viewers to switch language on proposals
                    </p>
                  </div>
                  <Switch
                    checked={settings.showLanguageSwitcher}
                    onCheckedChange={(checked) => updateSettings({ showLanguageSwitcher: checked })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default Translation Provider</Label>
                <div className="grid grid-cols-2 gap-4">
                  {TRANSLATION_PROVIDERS.map((provider) => (
                    <div
                      key={provider.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        settings.translationProvider === provider.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground'
                      }`}
                      onClick={() => updateSettings({ translationProvider: provider.id as any })}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{provider.icon}</span>
                        <div>
                          <p className="font-medium">{provider.name}</p>
                          <p className="text-sm text-muted-foreground">{provider.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
