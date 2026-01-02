import { useState } from 'react';
import { SystemHealth, HealthCategory, HealthCheckResult } from '@/lib/health/types';
import { HealthStatusCard } from './HealthStatusCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HealthCheckListProps {
  checks: HealthCheckResult[];
  categoryFilter?: HealthCategory | 'all';
  showSkipped?: boolean;
}

type SortOption = 'name' | 'status' | 'latency';

export function HealthCheckList({ 
  checks, 
  categoryFilter = 'all',
  showSkipped = true,
}: HealthCheckListProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('status');
  const [showSkippedState, setShowSkipped] = useState(showSkipped);

  // Filter checks
  let filteredChecks = checks;

  if (categoryFilter !== 'all') {
    filteredChecks = filteredChecks.filter(c => c.category === categoryFilter);
  }

  if (!showSkippedState) {
    filteredChecks = filteredChecks.filter(c => !c.skipped);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filteredChecks = filteredChecks.filter(
      c => c.name.toLowerCase().includes(searchLower) ||
           c.error?.toLowerCase().includes(searchLower)
    );
  }

  // Sort checks
  const sortedChecks = [...filteredChecks].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'latency') {
      return (b.latencyMs ?? 0) - (a.latencyMs ?? 0);
    }
    // Sort by status: unhealthy > degraded > unknown > healthy > skipped
    const statusOrder = { unhealthy: 0, degraded: 1, unknown: 2, checking: 3, healthy: 4 };
    const aOrder = a.skipped ? 5 : statusOrder[a.status];
    const bOrder = b.skipped ? 5 : statusOrder[b.status];
    return aOrder - bOrder;
  });

  const skippedCount = checks.filter(c => c.skipped).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search checks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Filter className="h-4 w-4" />
                Filter
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={showSkippedState}
                onCheckedChange={setShowSkipped}
              >
                Show skipped ({skippedCount})
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                Sort: {sortBy}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={sortBy === 'status'}
                onCheckedChange={() => setSortBy('status')}
              >
                Status (issues first)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === 'name'}
                onCheckedChange={() => setSortBy('name')}
              >
                Name (A-Z)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === 'latency'}
                onCheckedChange={() => setSortBy('latency')}
              >
                Latency (slowest first)
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2">
        {sortedChecks.map((check) => (
          <HealthStatusCard key={check.id} check={check} showDetails />
        ))}

        {sortedChecks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No checks match your filters
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Showing {sortedChecks.length} of {checks.length} checks
      </div>
    </div>
  );
}
