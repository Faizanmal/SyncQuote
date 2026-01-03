'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/use-api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  showConversionRate?: boolean;
  baseCurrency?: string;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
];

export function CurrencySelector({
  value,
  onChange,
  showConversionRate = false,
  baseCurrency,
}: CurrencySelectorProps) {
  const [conversionRate, setConversionRate] = useState<number | null>(null);
  const api = useApi();

  useEffect(() => {
    if (showConversionRate && baseCurrency && value !== baseCurrency) {
      fetchConversionRate();
    }
  }, [value, baseCurrency, showConversionRate]);

  const fetchConversionRate = async () => {
    if (!baseCurrency || value === baseCurrency) {
      setConversionRate(null);
      return;
    }

    try {
      const data = await api.get(`/currency/rate?from=${baseCurrency}&to=${value}`);
      setConversionRate(data.data.rate);
    } catch (error) {
      console.error('Failed to fetch conversion rate:', error);
    }
  };

  const selectedCurrency = CURRENCIES.find((c) => c.code === value);

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedCurrency && (
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {selectedCurrency.symbol} {selectedCurrency.code} - {selectedCurrency.name}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <span className="flex items-center gap-2">
                <span className="font-mono font-bold w-6">{currency.symbol}</span>
                <span className="font-medium">{currency.code}</span>
                <span className="text-muted-foreground">- {currency.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showConversionRate && conversionRate && baseCurrency && value !== baseCurrency && (
        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
          <TrendingUp className="h-3 w-3" />
          1 {baseCurrency} = {conversionRate.toFixed(4)} {value}
        </Badge>
      )}
    </div>
  );
}

export function formatCurrency(amount: number, currency: string): string {
  const currencyData = CURRENCIES.find((c) => c.code === currency);
  const symbol = currencyData?.symbol || '$';
  
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CurrencyConverter({
  amount,
  fromCurrency,
  toCurrency,
}: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
}) {
  const [converted, setConverted] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const api = useApi();

  useEffect(() => {
    if (fromCurrency !== toCurrency) {
      convertAmount();
    } else {
      setConverted(amount);
    }
  }, [amount, fromCurrency, toCurrency]);

  const convertAmount = async () => {
    setLoading(true);
    try {
      const data = await api.get(
        `/currency/convert?amount=${amount}&from=${fromCurrency}&to=${toCurrency}`
      );
      setConverted(data.data.converted);
    } catch (error) {
      toast.error('Failed to convert currency');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <span className="text-muted-foreground">Converting...</span>;
  }

  if (converted === null) {
    return null;
  }

  return (
    <div className="text-sm text-muted-foreground">
      {formatCurrency(amount, fromCurrency)} ≈ {formatCurrency(converted, toCurrency)}
    </div>
  );
}
