import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/contexts/SuperAdminContext';
import { useImpersonateAndNavigate } from '@/hooks/useImpersonateAndNavigate';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  User,
  Building2,
  Eye,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
  user_id: string;
  email: string;
  full_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  role: string | null;
}

export function GlobalUserSearch() {
  const navigate = useNavigate();
  const {
    isSuperAdmin,
    isSupportModeActive,
    logSuperAdminAction
  } = useSuperAdmin();
  const { impersonateAndNavigate, isNavigating } = useImpersonateAndNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  // Search users
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const searchUsers = async () => {
      setIsSearching(true);
      try {
        // Search profiles
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select(`
            user_id,
            email,
            full_name,
            organization_id,
            organization:organizations (
              name
            )
          `)
          .or(`email.ilike.%${debouncedQuery}%,full_name.ilike.%${debouncedQuery}%`)
          .limit(10);

        if (error) throw error;

        // Get roles for these users
        const userIds = profiles?.map(p => p.user_id) || [];
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]));

        const searchResults: SearchResult[] = (profiles || []).map(profile => ({
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          organization_id: profile.organization_id,
          organization_name: (profile.organization as { name: string } | null)?.name || null,
          role: rolesMap.get(profile.user_id) || null,
        }));

        setResults(searchResults);

        // Log search action
        logSuperAdminAction('GLOBAL_USER_SEARCH', undefined, undefined, undefined, {
          query: debouncedQuery,
          result_count: searchResults.length,
        });
      } catch (err) {
        console.error('Error searching users:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    searchUsers();
  }, [debouncedQuery, logSuperAdminAction]);

  const handleSelectUser = (user: SearchResult) => {
    setOpen(false);
    setQuery('');
    navigate(`/platform/users/${user.user_id}`);
  };

  const handleImpersonate = async (user: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user.organization_id || !user.organization_name) return;

    setOpen(false);
    setQuery('');

    await impersonateAndNavigate({
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
    });
  };

  // Only show for super admins in support mode
  if (!isSuperAdmin || !isSupportModeActive) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-64 justify-start text-muted-foreground border-purple-200 dark:border-purple-800"
        >
          <Search className="w-4 h-4 mr-2" />
          <span>Search users...</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by email or name..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isSearching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isSearching && query.length >= 2 && results.length === 0 && (
              <CommandEmpty>No users found.</CommandEmpty>
            )}

            {!isSearching && query.length < 2 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            )}

            {!isSearching && results.length > 0 && (
              <CommandGroup heading="Users">
                {results.map((user) => (
                  <CommandItem
                    key={user.user_id}
                    value={user.user_id}
                    onSelect={() => handleSelectUser(user)}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {user.full_name || user.email}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </div>
                        {user.organization_name && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {user.organization_name}
                            {user.role && (
                              <Badge variant="outline" className="ml-1 text-[10px] h-4">
                                {user.role}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectUser(user);
                        }}
                        title="View user details"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      {user.organization_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={(e) => handleImpersonate(user, e)}
                          disabled={isNavigating}
                          title="View app as this user"
                        >
                          {isNavigating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
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
