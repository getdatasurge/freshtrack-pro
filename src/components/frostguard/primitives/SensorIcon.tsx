import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { Thermometer, Droplets, DoorOpen, Battery, Signal, Wind } from 'lucide-react';
import { getSensorColor } from '../tokens/sensorColors';

const iconMap: Record<string, React.ElementType> = {
  temperature: Thermometer,
  humidity: Droplets,
  door: DoorOpen,
  battery: Battery,
  signal: Signal,
  co2: Wind,
};

export interface SensorIconProps extends React.HTMLAttributes<HTMLDivElement> {
  kind: string;
  size?: 'sm' | 'md' | 'lg';
  showBackground?: boolean;
}

const sizeClasses = {
  sm: '[&_svg]:h-4 [&_svg]:w-4',
  md: '[&_svg]:h-5 [&_svg]:w-5',
  lg: '[&_svg]:h-6 [&_svg]:w-6',
} as const;

const bgSizeClasses = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
} as const;

export const SensorIcon = React.forwardRef<HTMLDivElement, SensorIconProps>(
  ({ className, kind, size = 'md', showBackground = false, ...props }, ref) => {
    const Icon = iconMap[kind] || Thermometer;
    const colors = getSensorColor(kind);

    if (showBackground) {
      return (
        <div
          ref={ref}
          className={cn(
            'inline-flex items-center justify-center rounded-lg',
            colors.bg,
            colors.primary,
            bgSizeClasses[size],
            sizeClasses[size],
            className,
          )}
          {...props}
        >
          <Icon />
        </div>
      );
    }

    return (
      <div ref={ref} className={cn('inline-flex', colors.primary, sizeClasses[size], className)} {...props}>
        <Icon />
      </div>
    );
  },
);
SensorIcon.displayName = 'SensorIcon';
