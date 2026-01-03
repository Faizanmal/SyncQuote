'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Calculator,
  Package,
  Plus,
  Minus,
  Trash2,
  Check,
  Info,
  Sparkles,
  DollarSign,
  Percent,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Types
interface PricingTier {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  features: string[];
  popular?: boolean;
  maxQuantity?: number;
}

interface PricingOption {
  id: string;
  name: string;
  description?: string;
  type: 'checkbox' | 'quantity' | 'select' | 'slider';
  price: number;
  priceType: 'fixed' | 'per-unit' | 'percentage';
  category?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string; price: number }[];
  dependencies?: string[];
  incompatibleWith?: string[];
}

interface SelectedOption {
  optionId: string;
  value: boolean | number | string;
  quantity?: number;
}

interface PricingConfig {
  tiers: PricingTier[];
  options: PricingOption[];
  discounts: {
    type: 'volume' | 'coupon' | 'bundle';
    threshold?: number;
    percentage: number;
    code?: string;
  }[];
  currency: string;
  allowCustomQuantity?: boolean;
}

interface InteractivePricingCalculatorProps {
  config?: PricingConfig;
  onPriceChange?: (total: number, breakdown: PriceBreakdown) => void;
  onSelectionChange?: (selection: PricingSelection) => void;
  readOnly?: boolean;
}

interface PriceBreakdown {
  basePrice: number;
  optionsTotal: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: { name: string; price: number; quantity?: number }[];
}

interface PricingSelection {
  tierId: string | null;
  tierQuantity: number;
  options: SelectedOption[];
  couponCode?: string;
}

// Default configuration for demo
const defaultConfig: PricingConfig = {
  currency: 'USD',
  allowCustomQuantity: true,
  tiers: [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for small projects',
      basePrice: 999,
      features: ['Up to 5 users', 'Basic analytics', 'Email support', '1GB storage'],
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Best for growing teams',
      basePrice: 2499,
      features: ['Up to 25 users', 'Advanced analytics', 'Priority support', '10GB storage', 'API access'],
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For large organizations',
      basePrice: 4999,
      features: ['Unlimited users', 'Custom analytics', '24/7 support', 'Unlimited storage', 'Full API access', 'Custom integrations'],
    },
  ],
  options: [
    {
      id: 'additional-users',
      name: 'Additional Users',
      description: 'Add more team members',
      type: 'quantity',
      price: 49,
      priceType: 'per-unit',
      category: 'Users',
      min: 0,
      max: 100,
    },
    {
      id: 'storage-upgrade',
      name: 'Extra Storage',
      description: 'Additional cloud storage',
      type: 'select',
      price: 0,
      priceType: 'fixed',
      category: 'Storage',
      options: [
        { label: 'No extra storage', value: 'none', price: 0 },
        { label: '+25GB', value: '25gb', price: 99 },
        { label: '+100GB', value: '100gb', price: 249 },
        { label: '+500GB', value: '500gb', price: 499 },
      ],
    },
    {
      id: 'priority-support',
      name: 'Priority Support',
      description: '4-hour response time SLA',
      type: 'checkbox',
      price: 299,
      priceType: 'fixed',
      category: 'Support',
    },
    {
      id: 'custom-branding',
      name: 'Custom Branding',
      description: 'White-label solution with your logo',
      type: 'checkbox',
      price: 499,
      priceType: 'fixed',
      category: 'Customization',
    },
    {
      id: 'api-calls',
      name: 'API Call Volume',
      description: 'Monthly API request limit',
      type: 'slider',
      price: 0.001,
      priceType: 'per-unit',
      category: 'API',
      min: 10000,
      max: 1000000,
      step: 10000,
    },
    {
      id: 'training-hours',
      name: 'Training Hours',
      description: 'Onboarding and training sessions',
      type: 'quantity',
      price: 150,
      priceType: 'per-unit',
      category: 'Services',
      min: 0,
      max: 40,
    },
    {
      id: 'sso-integration',
      name: 'SSO Integration',
      description: 'Single Sign-On with your identity provider',
      type: 'checkbox',
      price: 199,
      priceType: 'fixed',
      category: 'Security',
    },
  ],
  discounts: [
    { type: 'volume', threshold: 5000, percentage: 5 },
    { type: 'volume', threshold: 10000, percentage: 10 },
    { type: 'coupon', code: 'SAVE20', percentage: 20 },
    { type: 'bundle', threshold: 3, percentage: 10 },
  ],
};

export function InteractivePricingCalculator({
  config = defaultConfig,
  onPriceChange,
  onSelectionChange,
  readOnly = false,
}: InteractivePricingCalculatorProps) {
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [tierQuantity, setTierQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [taxRate] = useState(0); // Can be made dynamic

  // Get selected tier
  const selectedTier = useMemo(() => {
    return config.tiers.find((t) => t.id === selectedTierId) || null;
  }, [config.tiers, selectedTierId]);

  // Calculate price breakdown
  const priceBreakdown = useMemo((): PriceBreakdown => {
    const items: { name: string; price: number; quantity?: number }[] = [];
    let basePrice = 0;
    let optionsTotal = 0;

    // Base tier price
    if (selectedTier) {
      basePrice = selectedTier.basePrice * tierQuantity;
      items.push({
        name: `${selectedTier.name} Plan`,
        price: selectedTier.basePrice,
        quantity: tierQuantity,
      });
    }

    // Calculate options
    selectedOptions.forEach((selected) => {
      const option = config.options.find((o) => o.id === selected.optionId);
      if (!option) return;

      let optionPrice = 0;
      const quantity = typeof selected.value === 'number' ? selected.value : 1;

      if (option.type === 'checkbox' && selected.value === true) {
        optionPrice = option.price;
      } else if (option.type === 'quantity' && typeof selected.value === 'number') {
        optionPrice = option.price * selected.value;
      } else if (option.type === 'select' && option.options) {
        const selectedOpt = option.options.find((o) => o.value === selected.value);
        if (selectedOpt) {
          optionPrice = selectedOpt.price;
        }
      } else if (option.type === 'slider' && typeof selected.value === 'number') {
        optionPrice = option.price * selected.value;
      }

      if (optionPrice > 0) {
        optionsTotal += optionPrice;
        items.push({
          name: option.name,
          price: option.type === 'quantity' || option.type === 'slider' ? option.price : optionPrice,
          quantity: option.type === 'quantity' || option.type === 'slider' ? quantity : undefined,
        });
      }
    });

    const subtotal = basePrice + optionsTotal;

    // Calculate discounts
    let discountPercentage = 0;
    
    // Volume discounts
    const volumeDiscount = config.discounts
      .filter((d) => d.type === 'volume' && d.threshold && subtotal >= d.threshold)
      .sort((a, b) => (b.threshold || 0) - (a.threshold || 0))[0];
    
    if (volumeDiscount) {
      discountPercentage = Math.max(discountPercentage, volumeDiscount.percentage);
    }

    // Bundle discount (based on number of options)
    const enabledOptionsCount = selectedOptions.filter((o) => {
      const opt = config.options.find((op) => op.id === o.optionId);
      if (opt?.type === 'checkbox') return o.value === true;
      if (opt?.type === 'quantity') return (o.value as number) > 0;
      if (opt?.type === 'select') return o.value !== 'none' && o.value !== '';
      return false;
    }).length;

    const bundleDiscount = config.discounts
      .filter((d) => d.type === 'bundle' && d.threshold && enabledOptionsCount >= d.threshold)
      .sort((a, b) => (b.threshold || 0) - (a.threshold || 0))[0];

    if (bundleDiscount) {
      discountPercentage = Math.max(discountPercentage, bundleDiscount.percentage);
    }

    // Coupon discount
    if (appliedCoupon) {
      const couponDiscount = config.discounts.find(
        (d) => d.type === 'coupon' && d.code?.toLowerCase() === appliedCoupon.toLowerCase()
      );
      if (couponDiscount) {
        discountPercentage = Math.max(discountPercentage, couponDiscount.percentage);
      }
    }

    const discount = subtotal * (discountPercentage / 100);
    const afterDiscount = subtotal - discount;
    const tax = afterDiscount * (taxRate / 100);
    const total = afterDiscount + tax;

    return {
      basePrice,
      optionsTotal,
      subtotal,
      discount,
      tax,
      total,
      items,
    };
  }, [selectedTier, tierQuantity, selectedOptions, config, appliedCoupon, taxRate]);

  // Notify parent of changes
  useEffect(() => {
    onPriceChange?.(priceBreakdown.total, priceBreakdown);
    onSelectionChange?.({
      tierId: selectedTierId,
      tierQuantity,
      options: selectedOptions,
      couponCode: appliedCoupon || undefined,
    });
  }, [priceBreakdown, selectedTierId, tierQuantity, selectedOptions, appliedCoupon]);

  // Handle option changes
  const updateOption = useCallback((optionId: string, value: boolean | number | string) => {
    setSelectedOptions((prev) => {
      const existing = prev.find((o) => o.optionId === optionId);
      if (existing) {
        return prev.map((o) => (o.optionId === optionId ? { ...o, value } : o));
      }
      return [...prev, { optionId, value }];
    });
  }, []);

  const getOptionValue = useCallback(
    (optionId: string): boolean | number | string => {
      const selected = selectedOptions.find((o) => o.optionId === optionId);
      if (selected) return selected.value;
      
      const option = config.options.find((o) => o.id === optionId);
      if (option?.type === 'checkbox') return false;
      if (option?.type === 'quantity') return option.min || 0;
      if (option?.type === 'slider') return option.min || 0;
      if (option?.type === 'select') return option.options?.[0]?.value || '';
      return false;
    },
    [selectedOptions, config.options]
  );

  // Apply coupon
  const applyCoupon = () => {
    const coupon = config.discounts.find(
      (d) => d.type === 'coupon' && d.code?.toLowerCase() === couponCode.toLowerCase()
    );
    if (coupon) {
      setAppliedCoupon(couponCode);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: config.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Group options by category
  const groupedOptions = useMemo(() => {
    const groups: Record<string, PricingOption[]> = {};
    config.options.forEach((option) => {
      const category = option.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(option);
    });
    return groups;
  }, [config.options]);

  return (
    <div className="space-y-6">
      {/* Tier Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Select Your Plan
          </CardTitle>
          <CardDescription>Choose the plan that best fits your needs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {config.tiers.map((tier) => (
              <div
                key={tier.id}
                onClick={() => !readOnly && setSelectedTierId(tier.id)}
                className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedTierId === tier.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } ${readOnly ? 'cursor-default' : ''}`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Popular
                  </Badge>
                )}
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                  <div className="text-2xl font-bold">{formatCurrency(tier.basePrice)}</div>
                  <ul className="space-y-1 text-sm">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                {selectedTierId === tier.id && (
                  <div className="absolute top-2 left-2">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tier Quantity */}
          {selectedTier && config.allowCustomQuantity && (
            <div className="mt-4 flex items-center gap-4">
              <Label>Quantity (Licenses)</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTierQuantity(Math.max(1, tierQuantity - 1))}
                  disabled={readOnly || tierQuantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={tierQuantity}
                  onChange={(e) => setTierQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                  min={1}
                  disabled={readOnly}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setTierQuantity(tierQuantity + 1)}
                  disabled={readOnly}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Customize Your Package
          </CardTitle>
          <CardDescription>Add optional features and services</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full" defaultValue={Object.keys(groupedOptions)}>
            {Object.entries(groupedOptions).map(([category, options]) => (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="text-sm font-medium">
                  {category}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {options.map((option) => (
                      <div key={option.id} className="flex items-start gap-4 p-3 border rounded-lg">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="font-medium">{option.name}</Label>
                            {option.description && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{option.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>

                          {/* Checkbox Option */}
                          {option.type === 'checkbox' && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                {formatCurrency(option.price)}
                              </span>
                              <Switch
                                checked={getOptionValue(option.id) as boolean}
                                onCheckedChange={(checked) => updateOption(option.id, checked)}
                                disabled={readOnly}
                              />
                            </div>
                          )}

                          {/* Quantity Option */}
                          {option.type === 'quantity' && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                {formatCurrency(option.price)} per unit
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    updateOption(
                                      option.id,
                                      Math.max(option.min || 0, (getOptionValue(option.id) as number) - 1)
                                    )
                                  }
                                  disabled={readOnly || (getOptionValue(option.id) as number) <= (option.min || 0)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  value={getOptionValue(option.id) as number}
                                  onChange={(e) =>
                                    updateOption(
                                      option.id,
                                      Math.min(
                                        option.max || 9999,
                                        Math.max(option.min || 0, parseInt(e.target.value) || 0)
                                      )
                                    )
                                  }
                                  className="w-16 h-8 text-center"
                                  disabled={readOnly}
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    updateOption(
                                      option.id,
                                      Math.min(option.max || 9999, (getOptionValue(option.id) as number) + 1)
                                    )
                                  }
                                  disabled={readOnly || (getOptionValue(option.id) as number) >= (option.max || 9999)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Select Option */}
                          {option.type === 'select' && option.options && (
                            <Select
                              value={getOptionValue(option.id) as string}
                              onValueChange={(value) => updateOption(option.id, value)}
                              disabled={readOnly}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {option.options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label} {opt.price > 0 && `(+${formatCurrency(opt.price)})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Slider Option */}
                          {option.type === 'slider' && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>{(option.min || 0).toLocaleString()}</span>
                                <span className="font-medium">
                                  {(getOptionValue(option.id) as number).toLocaleString()}
                                </span>
                                <span>{(option.max || 100).toLocaleString()}</span>
                              </div>
                              <Slider
                                value={[getOptionValue(option.id) as number]}
                                onValueChange={([value]) => updateOption(option.id, value)}
                                min={option.min || 0}
                                max={option.max || 100}
                                step={option.step || 1}
                                disabled={readOnly}
                              />
                              <div className="text-right text-sm">
                                {formatCurrency(option.price * (getOptionValue(option.id) as number))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Price Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Line items */}
          {priceBreakdown.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>
                {item.name}
                {item.quantity && item.quantity > 1 && (
                  <span className="text-muted-foreground"> × {item.quantity}</span>
                )}
              </span>
              <span>
                {formatCurrency(item.price * (item.quantity || 1))}
              </span>
            </div>
          ))}

          <Separator />

          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(priceBreakdown.subtotal)}</span>
          </div>

          {priceBreakdown.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Discount
              </span>
              <span>-{formatCurrency(priceBreakdown.discount)}</span>
            </div>
          )}

          {priceBreakdown.tax > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Tax ({taxRate}%)</span>
              <span>{formatCurrency(priceBreakdown.tax)}</span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between text-xl font-bold">
            <span>Total</span>
            <span>{formatCurrency(priceBreakdown.total)}</span>
          </div>

          {/* Coupon Code */}
          {!readOnly && (
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={applyCoupon}
                disabled={!couponCode || appliedCoupon === couponCode}
              >
                Apply
              </Button>
            </div>
          )}

          {appliedCoupon && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Coupon &quot;{appliedCoupon}&quot; applied!
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setAppliedCoupon(null)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            * Prices shown are estimates. Final pricing may vary based on specific requirements.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
