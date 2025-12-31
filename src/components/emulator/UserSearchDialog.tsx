import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search, User, AlertTriangle, Building, MapPin, Box } from "lucide-react";
import { getProject1Client, isProject1Configured, type Project1Profile } from "@/integrations/supabase/project1-client";

interface UserSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (user: Project1Profile) => void;
}

export function UserSearchDialog({ open, onOpenChange, onSelectUser }: UserSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Project1Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = isProject1Configured();

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || !isConfigured) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(searchQuery.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isConfigured]);

  const performSearch = useCallback(async (query: string) => {
    const client = getProject1Client();
    if (!client) {
      setError("Project 1 client not configured");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Search in profiles table by email or full_name
      const { data, error: queryError } = await client
        .from("profiles")
        .select("id, email, full_name, organization_id, site_id, unit_id")
        .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);

      if (queryError) {
        throw queryError;
      }

      setResults((data || []) as Project1Profile[]);
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Failed to search users");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelect = (user: Project1Profile) => {
    onSelectUser(user);
    onOpenChange(false);
    setSearchQuery("");
    setResults([]);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSearchQuery("");
    setResults([]);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Users (Project 1)
          </DialogTitle>
          <DialogDescription>
            Search for a user in FreshTrack Pro to auto-fill the form
          </DialogDescription>
        </DialogHeader>

        {!isConfigured ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">Project 1 not configured</p>
              <p className="text-sm mt-1">
                Add <code className="bg-muted px-1 rounded">VITE_P1_URL</code> and{" "}
                <code className="bg-muted px-1 rounded">VITE_P1_ANON_KEY</code> to your{" "}
                <code className="bg-muted px-1 rounded">.env</code> file.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Results */}
            {!isLoading && results.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelect(user)}
                    className="w-full p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-muted">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {user.full_name || "No name"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {user.email || "No email"}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {user.organization_id && (
                            <Badge variant="outline" className="text-xs">
                              <Building className="w-3 h-3 mr-1" />
                              Org
                            </Badge>
                          )}
                          {user.site_id && (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="w-3 h-3 mr-1" />
                              Site
                            </Badge>
                          )}
                          {user.unit_id && (
                            <Badge variant="outline" className="text-xs">
                              <Box className="w-3 h-3 mr-1" />
                              Unit
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && searchQuery.trim() && results.length === 0 && !error && (
              <div className="text-center py-6 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No users found matching "{searchQuery}"</p>
              </div>
            )}

            {/* Initial State */}
            {!isLoading && !searchQuery.trim() && (
              <div className="text-center py-6 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Start typing to search for users</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
