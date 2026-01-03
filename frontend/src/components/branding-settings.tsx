'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApi } from '@/hooks/use-api';
import { Palette, Upload, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BrandingSettings {
  companyName?: string;
  companyLogo?: string;
  brandColor?: string;
  brandColorSecondary?: string;
  customDomain?: string;
}

export function BrandingSettings() {
  const [settings, setSettings] = useState<BrandingSettings>({
    brandColor: '#4F46E5',
    brandColorSecondary: '#9333EA',
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const api = useApi();
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/users/profile');
      setSettings({
        companyName: response.data.companyName,
        companyLogo: response.data.companyLogo,
        brandColor: response.data.brandColor || '#4F46E5',
        brandColorSecondary: response.data.brandColorSecondary || '#9333EA',
        customDomain: response.data.customDomain,
      });
    } catch (error) {
      console.error('Failed to fetch branding settings:', error);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 2MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/storage/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSettings((prev) => ({ ...prev, companyLogo: response.data.url }));
      
      toast({
        title: 'Logo uploaded',
        description: 'Your company logo has been uploaded successfully',
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload logo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch('/users/profile', settings);
      
      toast({
        title: 'Settings saved',
        description: 'Your branding settings have been updated',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding & White-labeling
          </CardTitle>
          <CardDescription>
            Customize the appearance of your proposals and public pages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={settings.companyName || ''}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, companyName: e.target.value }))
              }
              placeholder="Your Company Inc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyLogo">Company Logo</Label>
            <div className="flex items-center gap-4">
              {settings.companyLogo && (
                <img
                  src={settings.companyLogo}
                  alt="Company logo"
                  className="h-16 w-16 object-contain border rounded"
                />
              )}
              <div>
                <Input
                  id="companyLogo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Label htmlFor="companyLogo" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => document.getElementById('companyLogo')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG up to 2MB
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brandColor">Primary Brand Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="brandColor"
                  type="color"
                  value={settings.brandColor}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, brandColor: e.target.value }))
                  }
                  className="h-10 w-16"
                />
                <Input
                  type="text"
                  value={settings.brandColor}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, brandColor: e.target.value }))
                  }
                  placeholder="#4F46E5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brandColorSecondary">Secondary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="brandColorSecondary"
                  type="color"
                  value={settings.brandColorSecondary}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      brandColorSecondary: e.target.value,
                    }))
                  }
                  className="h-10 w-16"
                />
                <Input
                  type="text"
                  value={settings.brandColorSecondary}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      brandColorSecondary: e.target.value,
                    }))
                  }
                  placeholder="#9333EA"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
            <Input
              id="customDomain"
              value={settings.customDomain || ''}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, customDomain: e.target.value }))
              }
              placeholder="proposals.yourcompany.com"
            />
            <p className="text-xs text-muted-foreground">
              Use your own domain for proposal links (requires DNS configuration)
            </p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4" />
              <span className="font-medium text-sm">Preview</span>
            </div>
            <div className="bg-white p-4 rounded border">
              <div className="flex items-center gap-3 mb-4">
                {settings.companyLogo ? (
                  <img
                    src={settings.companyLogo}
                    alt="Logo"
                    className="h-8 w-auto"
                  />
                ) : (
                  <div className="h-8 w-24 bg-gray-200 rounded" />
                )}
                <span className="font-semibold">{settings.companyName || 'Your Company'}</span>
              </div>
              <Button
                style={{
                  backgroundColor: settings.brandColor,
                  borderColor: settings.brandColor,
                }}
              >
                Sample Button
              </Button>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={fetchSettings}>
              Reset
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
