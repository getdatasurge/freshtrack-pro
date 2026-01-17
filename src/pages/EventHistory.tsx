import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  ExternalLink,
  Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  categoryConfig,
  severityConfig,
  getEventLabel,
  getEventIcon,
  inferCategory,
  inferSeverity,
  type EventCategory,
  type EventSeverity,
} from "@/lib/eventTypeMapper";
import { useUserRole } from "@/hooks/useUserRole";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";

interface EventLog {
  id: string;
  event_type: string;
  category: string | null;
  severity: string | null;
  title: string | null;
  recorded_at: string;
  organization_id: string;
  site_id: string | null;
  area_id: string | null;
  unit_id: string | null;
  actor_id: string | null;
  actor_type: string | null;
  event_data: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  // Joined data
  site?: { name: string } | null;
  area?: { name: string } | null;
  unit?: { name: string } | null;
  actor_profile?: { full_name: string | null; email: string } | null;
}

const EventHistory = () => {
  const navigate = useNavigate();
  const { role, isLoading: roleLoading } = useUserRole();
  const { effectiveOrgId, isInitialized } = useEffectiveIdentity();
  const [events, setEvents] = useState<EventLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");

  // Filter options
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);

  // Pagination
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const isAdmin = role === "owner" || role === "admin";

  // Load sites for filter dropdown
  useEffect(() => {
    const loadSites = async () => {
      if (!effectiveOrgId) return;
      const { data } = await supabase
        .from("sites")
        .select("id, name")
        .eq("organization_id", effectiveOrgId)
        .order("name");
      setSites(data || []);
    };
    loadSites();
  }, [effectiveOrgId]);

  const loadEvents = async (reset = false) => {
    if (!effectiveOrgId) return;

    setIsLoading(true);
    const currentPage = reset ? 0 : page;

    try {
      let query = supabase
        .from("event_logs")
        .select(`
          id,
          event_type,
          category,
          severity,
          title,
          recorded_at,
          organization_id,
          site_id,
          area_id,
          unit_id,
          actor_id,
          actor_type,
          event_data,
          ip_address,
          user_agent
        `)
        .eq("organization_id", effectiveOrgId)
        .order("recorded_at", { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      // Apply filters
      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }
      if (severityFilter && severityFilter !== "all") {
        query = query.eq("severity", severityFilter);
      }
      if (siteFilter && siteFilter !== "all") {
        query = query.eq("site_id", siteFilter);
      }
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,event_type.ilike.%${searchQuery}%`);
      }

      const { data: eventsData, error } = await query;

      if (error) throw error;

      // Fetch related data for context
      const enrichedEvents = await Promise.all(
        (eventsData || []).map(async (event) => {
          const eventData = typeof event.event_data === 'object' && event.event_data !== null && !Array.isArray(event.event_data)
            ? event.event_data as Record<string, any>
            : {};
          const enriched: EventLog = { ...event, event_data: eventData };

          // Fetch site name
          if (event.site_id) {
            const { data: site } = await supabase
              .from("sites")
              .select("name")
              .eq("id", event.site_id)
              .maybeSingle();
            enriched.site = site;
          }

          // Fetch area name
          if (event.area_id) {
            const { data: area } = await supabase
              .from("areas")
              .select("name")
              .eq("id", event.area_id)
              .maybeSingle();
            enriched.area = area;
          }

          // Fetch unit name
          if (event.unit_id) {
            const { data: unit } = await supabase
              .from("units")
              .select("name")
              .eq("id", event.unit_id)
              .maybeSingle();
            enriched.unit = unit;
          }

          // Fetch actor name
          if (event.actor_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", event.actor_id)
              .maybeSingle();
            enriched.actor_profile = profile;
          }

          return enriched;
        })
      );

      if (reset) {
        setEvents(enrichedEvents);
        setPage(0);
      } else {
        setEvents((prev) => [...prev, ...enrichedEvents]);
      }

      setHasMore((eventsData?.length || 0) === PAGE_SIZE);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading events:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isInitialized && effectiveOrgId) {
      loadEvents(true);
    }
  }, [isInitialized, effectiveOrgId, categoryFilter, severityFilter, siteFilter, searchQuery]);

  const toggleExpanded = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const buildContext = (event: EventLog): string => {
    const parts: string[] = [];
    if (event.site?.name) parts.push(event.site.name);
    if (event.area?.name) parts.push(event.area.name);
    if (event.unit?.name) parts.push(event.unit.name);
    return parts.join(" · ") || "—";
  };

  const getActorDisplay = (event: EventLog): string => {
    if (event.actor_type === "system") return "System";
    if (event.actor_profile) {
      return event.actor_profile.full_name || event.actor_profile.email;
    }
    return event.actor_id ? "User" : "System";
  };

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Event History</h1>
            <p className="text-sm text-muted-foreground">
              Complete audit timeline for your organization
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => loadEvents(true)}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  {Object.entries(severityConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-320px)]">
              {isLoading && events.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="w-10 h-10 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No events found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Events will appear here as actions occur in your organization
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {events.map((event) => {
                    const isExpanded = expandedEvents.has(event.id);
                    const category = (event.category as EventCategory) || inferCategory(event.event_type);
                    const severity = (event.severity as EventSeverity) || inferSeverity(event.event_type);
                    const catConfig = categoryConfig[category] || categoryConfig.system;
                    const sevConfig = severityConfig[severity] || severityConfig.info;
                    const Icon = getEventIcon(event.event_type);
                    const label = event.title || getEventLabel(event.event_type);

                    return (
                      <Collapsible
                        key={event.id}
                        open={isExpanded}
                        onOpenChange={() => toggleExpanded(event.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <button className="w-full p-4 text-left hover:bg-muted/30 transition-colors">
                            <div className="flex items-start gap-4">
                              {/* Icon */}
                              <div
                                className={`w-9 h-9 rounded-lg ${catConfig.bgColor} flex items-center justify-center flex-shrink-0`}
                              >
                                <Icon className={`w-4.5 h-4.5 ${catConfig.color}`} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-foreground">
                                    {label}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 ${catConfig.color}`}
                                  >
                                    {catConfig.label}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 ${sevConfig.color} ${sevConfig.borderColor}`}
                                  >
                                    {sevConfig.label}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {buildContext(event)}
                                </p>
                                <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70 mt-1">
                                  <span>
                                    {format(new Date(event.recorded_at), "MMM d, yyyy h:mm:ss a")}
                                  </span>
                                  <span>•</span>
                                  <span>{getActorDisplay(event)}</span>
                                </div>
                              </div>

                              {/* Expand icon */}
                              <div className="flex-shrink-0">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </button>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-0 ml-[52px] space-y-3">
                            {/* Key-value details for all users */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Event ID:</span>
                                <span className="ml-2 font-mono text-foreground">
                                  {event.id.slice(0, 8)}...
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Type:</span>
                                <span className="ml-2 font-mono text-foreground">
                                  {event.event_type}
                                </span>
                              </div>
                              {event.ip_address && (
                                <div>
                                  <span className="text-muted-foreground">IP:</span>
                                  <span className="ml-2 font-mono text-foreground">
                                    {event.ip_address}
                                  </span>
                                </div>
                              )}
                              {event.unit_id && (
                                <div>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-accent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/units/${event.unit_id}`);
                                    }}
                                  >
                                    Open Unit <ExternalLink className="w-3 h-3 ml-1" />
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Full JSON payload for admins only */}
                            {isAdmin && Object.keys(event.event_data).length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-muted-foreground mb-1">
                                  Event Data (Admin Only):
                                </p>
                                <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto font-mono">
                                  {JSON.stringify(event.event_data, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Key data summary for non-admins */}
                            {!isAdmin && Object.keys(event.event_data).length > 0 && (
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {Object.entries(event.event_data)
                                  .filter(
                                    ([key]) =>
                                      !key.includes("password") &&
                                      !key.includes("token") &&
                                      !key.includes("secret")
                                  )
                                  .slice(0, 6)
                                  .map(([key, value]) => (
                                    <div key={key}>
                                      <span className="text-muted-foreground capitalize">
                                        {key.replace(/_/g, " ")}:
                                      </span>
                                      <span className="ml-2 text-foreground">
                                        {typeof value === "object"
                                          ? JSON.stringify(value)
                                          : String(value)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}

                  {/* Load more */}
                  {hasMore && (
                    <div className="p-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPage((p) => p + 1);
                          loadEvents();
                        }}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EventHistory;
