import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { format, startOfWeek } from "date-fns";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Building2,
  Thermometer,
  Users,
  FileText,
  MessageSquare,
  ArrowRight,
  Star,
  Send
} from "lucide-react";
import { useEffectiveIdentity } from "@/hooks/useEffectiveIdentity";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  link?: string;
}

interface Site {
  id: string;
  name: string;
}

const PilotSetup = () => {
  const navigate = useNavigate();
  const { effectiveOrgId, isInitialized } = useEffectiveIdentity();
  const [isLoading, setIsLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [unitCount, setUnitCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  
  // Checklist state
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: "sites", label: "Add Site(s)", description: "Create at least one site location", completed: false, link: "/sites" },
    { id: "units", label: "Add Units (5-15)", description: "Add refrigeration units to monitor", completed: false },
    { id: "roles", label: "Assign Roles", description: "Add staff, managers, and owners", completed: false, link: "/settings?tab=users" },
    { id: "compliance", label: "Set Compliance Mode", description: "Configure manual logging intervals", completed: false, link: "/settings?tab=alerts" },
    { id: "export", label: "Verify Exports", description: "Test the export functionality", completed: false, link: "/reports" },
  ]);

  // Feedback form
  const [feedbackSiteId, setFeedbackSiteId] = useState<string>("");
  const [loggingSpeed, setLoggingSpeed] = useState([3]);
  const [alertFatigue, setAlertFatigue] = useState([3]);
  const [reportUsefulness, setReportUsefulness] = useState([3]);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isInitialized && effectiveOrgId) {
      loadData();
    } else if (isInitialized && !effectiveOrgId) {
      navigate("/onboarding");
    }
  }, [isInitialized, effectiveOrgId]);

  const loadData = async () => {
    if (!effectiveOrgId) return;
    
    try {
      setOrganizationId(effectiveOrgId);

      // Get sites using effectiveOrgId
      const { data: sitesData } = await supabase
        .from("sites")
        .select("id, name")
        .eq("organization_id", effectiveOrgId)
        .eq("is_active", true);

      setSites(sitesData || []);

      // Get unit count
      const { count: unitsCount } = await supabase
        .from("units")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      setUnitCount(unitsCount || 0);

      // Get user count
      const { count: usersCount } = await supabase
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", effectiveOrgId);

      setUserCount(usersCount || 0);

      // Update checklist based on data
      setChecklist(prev => prev.map(item => {
        if (item.id === "sites") return { ...item, completed: (sitesData?.length || 0) > 0 };
        if (item.id === "units") return { ...item, completed: (unitsCount || 0) >= 5 };
        if (item.id === "roles") return { ...item, completed: (usersCount || 0) >= 2 };
        return item;
      }));

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load pilot setup data");
    }
    setIsLoading(false);
  };

  const handleSubmitFeedback = async () => {
    if (!organizationId) return;

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

      const { error } = await supabase.from("pilot_feedback").upsert({
        organization_id: organizationId,
        site_id: feedbackSiteId || null,
        week_start: format(weekStart, "yyyy-MM-dd"),
        logging_speed_rating: loggingSpeed[0],
        alert_fatigue_rating: alertFatigue[0],
        report_usefulness_rating: reportUsefulness[0],
        notes: feedbackNotes || null,
        submitted_by: session.user.id,
      }, {
        onConflict: "organization_id,site_id,week_start",
      });

      if (error) throw error;

      toast.success("Feedback submitted successfully!");
      setFeedbackNotes("");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    }
    setIsSubmitting(false);
  };

  const completedCount = checklist.filter(c => c.completed).length;
  const progressPercent = (completedCount / checklist.length) * 100;

  if (isLoading) {
    return (
      <DashboardLayout title="Pilot Setup">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Pilot Setup">
      <div className="space-y-6">
        {/* Progress Header */}
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">Pilot Readiness</h2>
                <p className="text-muted-foreground">Complete these steps to run your pilot</p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-primary">{completedCount}/{checklist.length}</div>
                <p className="text-sm text-muted-foreground">Steps Complete</p>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Setup Checklist
              </CardTitle>
              <CardDescription>
                Complete these items before starting your pilot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {checklist.map(item => (
                <div 
                  key={item.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                    item.completed ? "bg-safe/5 border-safe/30" : "bg-muted/50 border-border"
                  }`}
                >
                  {item.completed ? (
                    <CheckCircle2 className="w-6 h-6 text-safe flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                  {item.link && !item.completed && (
                    <Button variant="outline" size="sm" onClick={() => navigate(item.link!)}>
                      Go <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                  {item.completed && (
                    <Badge variant="outline" className="bg-safe/10 text-safe border-safe/30">
                      Done
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Setup</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <div className="text-2xl font-bold">{sites.length}</div>
                    <div className="text-sm text-muted-foreground">Sites</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Thermometer className="w-8 h-8 mx-auto mb-2 text-accent" />
                    <div className="text-2xl font-bold">{unitCount}</div>
                    <div className="text-sm text-muted-foreground">Units</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <Users className="w-8 h-8 mx-auto mb-2 text-safe" />
                    <div className="text-2xl font-bold">{userCount}</div>
                    <div className="text-sm text-muted-foreground">Users</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feedback Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-accent" />
                  Weekly Pilot Feedback
                </CardTitle>
                <CardDescription>
                  Help us improve by sharing your experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Site Selection */}
                <div className="space-y-2">
                  <Label>Site (Optional)</Label>
                  <Select value={feedbackSiteId} onValueChange={setFeedbackSiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All sites" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Sites</SelectItem>
                      {sites.map(site => (
                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Logging Speed */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Logging Speed</Label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star 
                          key={n} 
                          className={`w-4 h-4 ${n <= loggingSpeed[0] ? "text-warning fill-warning" : "text-muted"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <Slider
                    value={loggingSpeed}
                    onValueChange={setLoggingSpeed}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">1 = Too slow, 5 = Perfect</p>
                </div>

                {/* Alert Fatigue */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Alert Fatigue</Label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star 
                          key={n} 
                          className={`w-4 h-4 ${n <= alertFatigue[0] ? "text-warning fill-warning" : "text-muted"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <Slider
                    value={alertFatigue}
                    onValueChange={setAlertFatigue}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">1 = Too many alerts, 5 = Just right</p>
                </div>

                {/* Report Usefulness */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Report Usefulness</Label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star 
                          key={n} 
                          className={`w-4 h-4 ${n <= reportUsefulness[0] ? "text-warning fill-warning" : "text-muted"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <Slider
                    value={reportUsefulness}
                    onValueChange={setReportUsefulness}
                    min={1}
                    max={5}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">1 = Not useful, 5 = Very useful</p>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder="Any suggestions or issues..."
                    rows={3}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleSubmitFeedback}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Submit Feedback
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PilotSetup;
