import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableDropdownProps {
  value: string | string[];
  onValueChange?: (value: string | string[]) => void;
  onChange?: (value: string) => void; // For backward compatibility
  options: string[];
  placeholder?: string;
  className?: string;
  allowCustomInput?: boolean;
  multiple?: boolean;
}

export function SearchableDropdown({
  value,
  onValueChange,
  onChange,
  options,
  placeholder = "Select or type...",
  className,
  allowCustomInput = true,
  multiple = false,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleSelect = (selectedValue: string) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(selectedValue)
        ? currentValues.filter(v => v !== selectedValue)
        : [...currentValues, selectedValue];
      onValueChange?.(newValues);
    } else {
      onValueChange?.(selectedValue);
      onChange?.(selectedValue);
      setOpen(false);
    }
    setSearchValue("");
  };

  const handleInputChange = (inputValue: string) => {
    setSearchValue(inputValue);
    if (allowCustomInput && !multiple) {
      onValueChange?.(inputValue);
      onChange?.(inputValue);
    }
  };

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-left font-normal", className)}
        >
          <span className="truncate">
            {multiple 
              ? Array.isArray(value) && value.length > 0
                ? `${value.length} selected`
                : placeholder
              : value || placeholder
            }
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-background border shadow-md z-50" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command>
          <div className="flex items-center border-b px-3">
            <CommandInput
              ref={inputRef}
              placeholder="Search or type new..."
              value={searchValue}
              onValueChange={handleInputChange}
              className="h-9"
            />
          </div>
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>
              {allowCustomInput && searchValue ? (
                <div className="px-2 py-1.5">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => handleSelect(searchValue)}
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    Add "{searchValue}"
                  </Button>
                </div>
              ) : (
                "No options found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => handleSelect(option)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      multiple 
                        ? (Array.isArray(value) && value.includes(option)) ? "opacity-100" : "opacity-0"
                        : value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}