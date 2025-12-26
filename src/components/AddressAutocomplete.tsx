/// <reference types="@types/google.maps" />
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface AddressComponents {
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onPlaceSelect: (components: AddressComponents) => void;
  placeholder?: string;
  id?: string;
}

declare global {
  interface Window {
    google?: typeof google;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const AddressAutocomplete = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Start typing an address...",
  id = "address-autocomplete",
}: AddressAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("Google Maps API key is not configured");
      setIsLoading(false);
      return;
    }

    // Check if script is already loaded
    if (window.google?.maps?.places) {
      setIsScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        setIsScriptLoaded(true);
        setIsLoading(false);
      });
      return;
    }

    // Load the script
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsScriptLoaded(true);
      setIsLoading(false);
    };
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
      setIsLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup is tricky with Google Maps, leave script in place
    };
  }, []);

  // Initialize autocomplete
  useEffect(() => {
    if (!isScriptLoaded || !inputRef.current || !window.google?.maps?.places) {
      return;
    }

    // Clean up previous instance
    if (autocompleteRef.current) {
      google.maps.event.clearInstanceListeners(autocompleteRef.current);
    }

    // Create autocomplete instance
    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address"],
    });

    // Handle place selection
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place?.address_components) return;

      const components: AddressComponents = {
        address: "",
        city: "",
        state: "",
        postalCode: "",
      };

      let streetNumber = "";
      let route = "";

      for (const component of place.address_components) {
        const type = component.types[0];
        switch (type) {
          case "street_number":
            streetNumber = component.long_name;
            break;
          case "route":
            route = component.long_name;
            break;
          case "locality":
          case "sublocality_level_1":
            if (!components.city) {
              components.city = component.long_name;
            }
            break;
          case "administrative_area_level_1":
            components.state = component.short_name;
            break;
          case "postal_code":
            components.postalCode = component.long_name;
            break;
        }
      }

      components.address = [streetNumber, route].filter(Boolean).join(" ");
      
      onChange(components.address);
      onPlaceSelect(components);
    });

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isScriptLoaded, onChange, onPlaceSelect]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
