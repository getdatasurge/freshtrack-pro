import * as React from 'react';
import { cn } from '@/lib/design-system/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'text', width, height, lines = 1, style, ...props }, ref) => {
    const baseClass = 'animate-pulse bg-zinc-800 motion-reduce:animate-none';

    if (variant === 'circular') {
      return (
        <div
          ref={ref}
          className={cn(baseClass, 'rounded-full', className)}
          style={{ width: width || 40, height: height || 40, ...style }}
          {...props}
        />
      );
    }

    if (variant === 'rectangular') {
      return (
        <div
          ref={ref}
          className={cn(baseClass, 'rounded-lg', className)}
          style={{ width, height, ...style }}
          {...props}
        />
      );
    }

    // Text variant
    if (lines > 1) {
      return (
        <div ref={ref} className={cn('space-y-2', className)} {...props}>
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={cn(baseClass, 'h-4 rounded', i === lines - 1 && 'w-3/4')}
              style={i === 0 ? { width, height } : undefined}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(baseClass, 'h-4 rounded', className)}
        style={{ width, height, ...style }}
        {...props}
      />
    );
  },
);
Skeleton.displayName = 'Skeleton';
