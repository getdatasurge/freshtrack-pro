import { HealthStatus } from '@/lib/health/types';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, XCircle, HelpCircle, Loader2 } from 'lucide-react';

interface HealthStatusBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  isChecking?: boolean;
}

const statusConfig: Record<HealthStatus, {
  icon: typeof CheckCircle;
  label: string;
  className: string;
}> = {
  healthy: {
    icon: CheckCircle,
    label: 'Healthy',
    className: 'text-green-500 bg-green-500/10',
  },
  degraded: {
    icon: AlertCircle,
    label: 'Degraded',
    className: 'text-yellow-500 bg-yellow-500/10',
  },
  unhealthy: {
    icon: XCircle,
    label: 'Unhealthy',
    className: 'text-red-500 bg-red-500/10',
  },
  unknown: {
    icon: HelpCircle,
    label: 'Unknown',
    className: 'text-muted-foreground bg-muted',
  },
  checking: {
    icon: Loader2,
    label: 'Checking...',
    className: 'text-blue-500 bg-blue-500/10',
  },
};

const sizeConfig = {
  sm: { icon: 'h-3 w-3', badge: 'px-1.5 py-0.5 text-xs gap-1' },
  md: { icon: 'h-4 w-4', badge: 'px-2 py-1 text-sm gap-1.5' },
  lg: { icon: 'h-5 w-5', badge: 'px-3 py-1.5 text-base gap-2' },
};

export function HealthStatusBadge({ 
  status, 
  size = 'md', 
  showLabel = true,
  isChecking = false,
}: HealthStatusBadgeProps) {
  const effectiveStatus = isChecking ? 'checking' : status;
  const config = statusConfig[effectiveStatus];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        sizeStyles.badge,
        config.className
      )}
    >
      <Icon 
        className={cn(
          sizeStyles.icon,
          isChecking && 'animate-spin'
        )} 
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
