import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { text as textTokens, surface, border, radius } from '@/lib/design-system/tokens';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  widgetName?: string;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for individual widgets.
 * Prevents a single widget crash from taking down the entire dashboard.
 */
export class WidgetErrorBoundary extends React.Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            'flex flex-col items-center justify-center h-full min-h-[120px] p-4 border rounded-xl',
            surface.raised,
            border.default,
          )}
          role="alert"
        >
          <AlertTriangle className={cn('h-8 w-8 mb-2', textTokens.disabled)} />
          <p className={cn('text-sm font-medium', textTokens.secondary)}>
            {this.props.widgetName ? `${this.props.widgetName} error` : 'Widget error'}
          </p>
          <p className={cn('text-xs mt-1 text-center', textTokens.tertiary)}>
            {this.state.error?.message || 'Something went wrong'}
          </p>
          <button
            onClick={this.handleRetry}
            className={cn(
              'mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg',
              surface.hover,
              textTokens.secondary,
              'hover:bg-zinc-700 transition-colors',
            )}
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
