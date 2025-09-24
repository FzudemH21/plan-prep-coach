import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { useToolboxData } from '@/hooks/useToolboxData';

interface AddMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddMethod: (method: string) => void;
  excludedMethods: string[];
}

export function AddMethodDialog({ open, onOpenChange, onAddMethod, excludedMethods }: AddMethodDialogProps) {
  const { data: toolboxData } = useToolboxData();
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Generate available methods from toolbox data
  const availableMethods = useMemo(() => {
    if (!toolboxData?.entries) return [];

    // Extract unique category-subcategory combinations
    const methodsSet = new Set<string>();
    const methodsWithCategories: Array<{ method: string; category: string; subCategory: string }> = [];

    toolboxData.entries.forEach(entry => {
      const method = entry.subCategory 
        ? `${entry.category} - ${entry.subCategory}`
        : entry.category;
      
      if (!methodsSet.has(method)) {
        methodsSet.add(method);
        methodsWithCategories.push({
          method,
          category: entry.category,
          subCategory: entry.subCategory || 'General'
        });
      }
    });

    // Filter out already selected methods
    return methodsWithCategories.filter(item => 
      !excludedMethods.includes(item.method)
    );
  }, [toolboxData, excludedMethods]);

  // Get unique categories for filtering
  const categories = useMemo(() => {
    const cats = new Set<string>();
    availableMethods.forEach(item => cats.add(item.category));
    return Array.from(cats).sort();
  }, [availableMethods]);

  // Filter methods based on search and category
  const filteredMethods = useMemo(() => {
    let filtered = availableMethods;

    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.method.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.subCategory.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => a.method.localeCompare(b.method));
  }, [availableMethods, selectedCategory, searchQuery]);

  const handleAddMethod = () => {
    if (selectedMethod) {
      onAddMethod(selectedMethod);
      setSelectedMethod('');
      setSearchQuery('');
      setSelectedCategory('all');
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setSelectedMethod('');
    setSearchQuery('');
    setSelectedCategory('all');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="!z-[110]" />
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col !z-[100]">
        <DialogHeader>
          <DialogTitle>Add Training Method</DialogTitle>
          <DialogDescription>
            Select a training method from the toolbox to add to your periodization plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search and Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Methods</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by method name, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Filter by Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent className="!z-[120] bg-popover">
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Method Selection */}
          <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
            <Label>Available Methods ({filteredMethods.length})</Label>
            <div className="flex-1 border rounded-md overflow-y-auto p-2 space-y-1">
              {filteredMethods.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {availableMethods.length === 0 
                    ? "No methods available to add"
                    : "No methods match your search criteria"
                  }
                </p>
              ) : (
                filteredMethods.map((item) => (
                  <div
                    key={item.method}
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selectedMethod === item.method
                        ? 'bg-primary text-primary-foreground border-primary [&_*]:!text-primary-foreground [&_.badge]:!bg-primary-foreground [&_.badge]:!text-primary'
                        : 'hover:bg-muted border-border'
                    }`}
                    onClick={() => setSelectedMethod(item.method)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{item.method}</p>
                        <div className="flex gap-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs badge ${
                              selectedMethod === item.method 
                                ? '!bg-primary-foreground !text-primary !border-primary-foreground' 
                                : ''
                            }`}
                          >
                            {item.category}
                          </Badge>
                          {item.subCategory !== 'General' && (
                            <Badge 
                              variant="secondary" 
                              className={`text-xs badge ${
                                selectedMethod === item.method 
                                  ? '!bg-primary-foreground !text-primary' 
                                  : ''
                              }`}
                            >
                              {item.subCategory}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddMethod} 
            disabled={!selectedMethod}
          >
            Add Method
          </Button>
        </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}