import { Thermometer } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";

interface BrandedLogoProps {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

const BrandedLogo = ({ showText = true, size = "md" }: BrandedLogoProps) => {
  const { branding, loading } = useBranding();

  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  };

  // Show custom logo if available
  if (branding?.logoUrl) {
    return (
      <div className="flex items-center gap-3">
        <img 
          src={branding.logoUrl} 
          alt={branding.name} 
          className={`${sizeClasses[size]} object-contain rounded-lg`}
        />
        {showText && (
          <span className={`${textSizes[size]} font-bold text-foreground`}>
            {branding.name}
          </span>
        )}
      </div>
    );
  }

  // Default FrostGuard branding
  return (
    <div className="flex items-center gap-3">
      <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center`}>
        <Thermometer className={`${iconSizes[size]} text-white`} />
      </div>
      {showText && (
        <span className={`${textSizes[size]} font-bold text-foreground`}>
          {loading ? "..." : "FrostGuard"}
        </span>
      )}
    </div>
  );
};

export default BrandedLogo;
