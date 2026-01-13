/**
 * Dashboard Error Boundary
 * 
 * Catches runtime errors in the dashboard region and provides
 * a recovery UI with the option to reset the layout cache.
 */

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearDraft, type DraftKeyParams } from "../utils/draftManager";

interface DashboardErrorBoundaryProps {
  children: ReactNode;
  entityType?: "site" | "unit";
  entityId?: string;
  userId?: string;
  onReset?: () => void;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[DashboardErrorBoundary] Dashboard crashed:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleResetCache = () => {
    const { entityType, entityId, userId } = this.props;
    
    try {
      // Clear all drafts for this entity if we have the params
      if (entityType && entityId && userId) {
        // Clear drafts for all layout keys
        ["default", "layout1", "layout2", "layout3"].forEach((layoutId) => {
          const params: DraftKeyParams = { entityType, entityId, layoutId, userId };
          try {
            clearDraft(params);
          } catch {
            // Ignore individual clear failures
          }
        });
      }
      
      // Also try to clear any draft keys we can find in localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("fg:layoutDraft:")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore
        }
      });
    } catch (error) {
      console.error("[DashboardErrorBoundary] Failed to clear cache:", error);
    }
    
    // Reset error state and retry
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg">Dashboard Failed to Load</CardTitle>
            </div>
            <CardDescription>
              Something went wrong while rendering the dashboard. This might be caused by
              corrupted layout data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={this.handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={this.handleResetCache}
              >
                Reset Layout Cache
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
