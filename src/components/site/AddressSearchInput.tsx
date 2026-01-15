import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Loader2, MapPin, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchAddress, GeocodingResult } from "@/lib/geocoding/geocodingService";

interface AddressSearchInputProps {
  onSelect: (result: GeocodingResult) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AddressSearchInput({
  onSelect,
  disabled = false,
  placeholder = "Search city, address, or ZIP...",
}: AddressSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await searchAddress(searchQuery);
      setResults(searchResults);
      setOpen(searchResults.length > 0 || searchQuery.length >= 3);
    } catch (err) {
      setError("Search unavailable. Enter coordinates manually.");
      setResults([]);
      setOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce search
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 500);
    },
    [performSearch]
  );

  const handleSelect = useCallback(
    (result: GeocodingResult) => {
      setQuery(result.shortName);
      setOpen(false);
      setResults([]);
      onSelect(result);
    },
    [onSelect]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-9 pr-9"
            onFocus={() => {
              if (results.length > 0 || error) {
                setOpen(true);
              }
            }}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 max-h-60 overflow-hidden"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command>
          <CommandList>
            {error ? (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ) : results.length === 0 && query.length >= 3 && !isLoading ? (
              <CommandEmpty>No locations found for "{query}"</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((result, index) => (
                  <CommandItem
                    key={`${result.latitude}-${result.longitude}-${index}`}
                    value={result.displayName}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium truncate">
                        {result.shortName}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {result.displayName}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
