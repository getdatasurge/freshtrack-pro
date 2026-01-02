import React from 'react';
import { useDebugContext } from '@/contexts/DebugContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bug, Keyboard } from 'lucide-react';

export function DebugModeToggle() {
  const { isDebugEnabled, setDebugEnabled, isTerminalVisible, toggleTerminal } = useDebugContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Debug Mode
        </CardTitle>
        <CardDescription>
          Enable in-app debug terminal for real-time logging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="debug-mode">Enable Debug Mode</Label>
            <p className="text-xs text-muted-foreground">
              Show debug terminal with system events
            </p>
          </div>
          <Switch
            id="debug-mode"
            checked={isDebugEnabled}
            onCheckedChange={setDebugEnabled}
          />
        </div>

        {isDebugEnabled && (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="terminal-visible">Show Terminal</Label>
              <p className="text-xs text-muted-foreground">
                Toggle terminal visibility
              </p>
            </div>
            <Switch
              id="terminal-visible"
              checked={isTerminalVisible}
              onCheckedChange={toggleTerminal}
            />
          </div>
        )}

        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Keyboard className="h-4 w-4" />
            <span>Keyboard shortcut:</span>
            <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+Shift+D</kbd>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 pt-2">
          <p>When enabled:</p>
          <ul className="list-disc list-inside pl-2 space-y-0.5">
            <li>Bottom-docked terminal shows all system events</li>
            <li>Edge function calls are logged with timing</li>
            <li>Sync operations are tracked</li>
            <li>No secrets are exposed (auto-redacted)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
