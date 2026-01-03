'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PricingItem {
  id: string;
  name: string;
  description?: string;
  type: 'FIXED' | 'OPTIONAL' | 'QUANTITY';
  price: number;
  quantity: number;
  enabled: boolean;
}

interface PricingTableProps {
  items: PricingItem[];
  onChange: (items: PricingItem[]) => void;
  editable?: boolean;
  onClientChange?: (items: PricingItem[]) => void;
}

export function PricingTable({
  items,
  onChange,
  editable = true,
  onClientChange,
}: PricingTableProps) {
  const [taxRate, setTaxRate] = useState(0);

  const addItem = () => {
    const newItem: PricingItem = {
      id: `item-${Date.now()}`,
      name: '',
      description: '',
      type: 'FIXED',
      price: 0,
      quantity: 1,
      enabled: true,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (id: string, updates: Partial<PricingItem>) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    onChange(newItems);
    if (onClientChange) {
      onClientChange(newItems);
    }
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const toggleItem = (id: string) => {
    updateItem(id, { enabled: !items.find((i) => i.id === id)?.enabled });
  };

  const calculateSubtotal = () => {
    return items
      .filter((item) => item.enabled)
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * (taxRate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pricing</CardTitle>
          {editable && (
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'flex gap-4 items-start p-4 border rounded-lg',
                !item.enabled && 'opacity-50 bg-gray-50 dark:bg-gray-800'
              )}
            >
              {editable && (
                <div className="flex items-center gap-2">
                  <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                </div>
              )}

              <div className="flex-1 grid grid-cols-12 gap-4">
                <div className="col-span-4">
                  {editable ? (
                    <div className="space-y-2">
                      <Label htmlFor={`item-name-${item.id}`}>Item Name</Label>
                      <Input
                        id={`item-name-${item.id}`}
                        value={item.name}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        placeholder="Service or product name"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {item.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  {editable ? (
                    <div className="space-y-2">
                      <Label htmlFor={`item-type-${item.id}`}>Type</Label>
                      <Select
                        value={item.type}
                        onValueChange={(value: PricingItem['type']) =>
                          updateItem(item.id, { type: value })
                        }
                      >
                        <SelectTrigger id={`item-type-${item.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIXED">Fixed</SelectItem>
                          <SelectItem value="OPTIONAL">Optional</SelectItem>
                          <SelectItem value="QUANTITY">Quantity</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {item.type === 'OPTIONAL' && 'Optional'}
                      {item.type === 'QUANTITY' && 'Quantity-based'}
                      {item.type === 'FIXED' && 'Fixed'}
                    </div>
                  )}
                </div>

                <div className="col-span-2">
                  {editable ? (
                    <div className="space-y-2">
                      <Label htmlFor={`item-price-${item.id}`}>Price</Label>
                      <Input
                        id={`item-price-${item.id}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) =>
                          updateItem(item.id, { price: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  ) : (
                    <div className="font-medium">${item.price.toFixed(2)}</div>
                  )}
                </div>

                <div className="col-span-2">
                  {editable || item.type === 'QUANTITY' ? (
                    <div className="space-y-2">
                      <Label htmlFor={`item-qty-${item.id}`}>Quantity</Label>
                      <Input
                        id={`item-qty-${item.id}`}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })
                        }
                        disabled={!editable && item.type !== 'QUANTITY'}
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {item.quantity}x
                    </div>
                  )}
                </div>

                <div className="col-span-2 flex items-end justify-end">
                  <div className="font-semibold">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              </div>

              {editable && (
                <div className="flex gap-2">
                  {item.type === 'OPTIONAL' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleItem(item.id)}
                    >
                      {item.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              )}
              {!editable && item.type === 'OPTIONAL' && (
                <div>
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => toggleItem(item.id)}
                    className="h-5 w-5"
                  />
                </div>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No pricing items added yet
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-2">
          {editable && (
            <div className="flex items-center justify-between">
              <Label htmlFor="tax-rate">Tax Rate (%)</Label>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
          </div>

          {taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Tax ({taxRate}%)
              </span>
              <span className="font-medium">${calculateTax().toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total</span>
            <span>${calculateTotal().toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
