/**
 * Security Tab - RBAC Role Permissions Display & Management
 *
 * This tab provides visibility into the role-based access control system,
 * showing users their current role and the permissions matrix for all roles.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Shield,
  Crown,
  Users,
  User,
  Eye,
  CheckCircle2,
  XCircle,
  Info,
  Lock,
  Building2,
  Thermometer,
  Bell,
  LayoutDashboard,
  FileText,
  Settings,
  ClipboardCheck,
} from 'lucide-react';
import {
  type Role,
  type Permission,
  ROLE_CONFIG,
  ROLE_HIERARCHY,
  PERMISSION_CATEGORIES,
  can,
  getPermissionDescription,
} from '@/lib/permissions';

interface SecurityTabProps {
  currentRole: Role | null;
  organizationId: string | null;
}

// Icons for role display
const roleIcons: Record<Role, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  manager: Users,
  staff: User,
  viewer: Eye,
  inspector: ClipboardCheck,
};

// Icons for permission categories
const categoryIcons: Record<string, React.ElementType> = {
  organization: Building2,
  users: Users,
  sites: Building2,
  units: Thermometer,
  devices: Settings,
  operations: Bell,
  dashboard: LayoutDashboard,
  reports: FileText,
  admin: Lock,
};

// Category display names
const categoryNames: Record<string, string> = {
  organization: 'Organization',
  users: 'User Management',
  sites: 'Sites & Areas',
  units: 'Units',
  devices: 'Devices & Sensors',
  operations: 'Operations & Alerts',
  dashboard: 'Dashboard & Widgets',
  reports: 'Reports',
  admin: 'Administration',
};

export function SecurityTab({ currentRole, organizationId }: SecurityTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Get display role info
  const currentRoleConfig = currentRole ? ROLE_CONFIG[currentRole] : null;
  const CurrentRoleIcon = currentRole ? roleIcons[currentRole] : User;

  // Filter permissions by category
  const getFilteredPermissions = (): Permission[] => {
    if (selectedCategory === 'all') {
      return Object.values(PERMISSION_CATEGORIES).flat();
    }
    return PERMISSION_CATEGORIES[selectedCategory as keyof typeof PERMISSION_CATEGORIES] || [];
  };

  return (
    <div className="space-y-6">
      {/* Current User Role Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Access Level
          </CardTitle>
          <CardDescription>
            Your current role determines what actions you can perform in this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentRole && currentRoleConfig ? (
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${currentRoleConfig.color}`}>
                <CurrentRoleIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold">{currentRoleConfig.label}</h3>
                  <Badge variant="outline" className={currentRoleConfig.color}>
                    Active
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentRoleConfig.description}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Unable to determine your role. Please contact an administrator.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Role Permissions Matrix
          </CardTitle>
          <CardDescription>
            Overview of what each role can do in the system. This helps understand access levels when assigning roles to team members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Filter Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="all" className="text-xs">
                All
              </TabsTrigger>
              {Object.keys(PERMISSION_CATEGORIES).map(category => {
                const CategoryIcon = categoryIcons[category] || Settings;
                return (
                  <TabsTrigger key={category} value={category} className="text-xs flex items-center gap-1">
                    <CategoryIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">{categoryNames[category]}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-4">
              <ScrollArea className="w-full">
                <div className="min-w-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px] sticky left-0 bg-background">Permission</TableHead>
                        {ROLE_HIERARCHY.map(role => {
                          const RoleIcon = roleIcons[role];
                          const config = ROLE_CONFIG[role];
                          const isCurrentRole = role === currentRole;
                          return (
                            <TableHead
                              key={role}
                              className={`text-center w-[80px] ${isCurrentRole ? 'bg-accent/10' : ''}`}
                            >
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex flex-col items-center gap-1">
                                      <RoleIcon className={`h-4 w-4 ${isCurrentRole ? 'text-accent' : ''}`} />
                                      <span className={`text-xs ${isCurrentRole ? 'font-bold' : ''}`}>
                                        {config.label}
                                      </span>
                                      {isCurrentRole && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                                          You
                                        </Badge>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">{config.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredPermissions().map(permission => (
                        <TableRow key={permission}>
                          <TableCell className="font-medium sticky left-0 bg-background">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help">
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm">{getPermissionDescription(permission)}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs font-mono">{permission}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          {ROLE_HIERARCHY.map(role => {
                            const hasPermission = can(role, permission);
                            const isCurrentRole = role === currentRole;
                            const isCurrentPermission = currentRole && can(currentRole, permission);
                            return (
                              <TableCell
                                key={role}
                                className={`text-center ${isCurrentRole ? 'bg-accent/10' : ''}`}
                              >
                                {hasPermission ? (
                                  <CheckCircle2
                                    className={`h-5 w-5 mx-auto ${
                                      isCurrentRole && isCurrentPermission
                                        ? 'text-safe'
                                        : 'text-safe/70'
                                    }`}
                                  />
                                ) : (
                                  <XCircle className="h-5 w-5 mx-auto text-muted-foreground/30" />
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Role Hierarchy Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Role Hierarchy
          </CardTitle>
          <CardDescription>
            Roles are organized in a hierarchy from most to least privileged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROLE_HIERARCHY.map((role, index) => {
              const config = ROLE_CONFIG[role];
              const RoleIcon = roleIcons[role];
              const isCurrentRole = role === currentRole;

              return (
                <div
                  key={role}
                  className={`p-4 rounded-lg border ${
                    isCurrentRole ? 'border-accent bg-accent/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}
                    >
                      <RoleIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.label}</span>
                        {isCurrentRole && (
                          <Badge variant="outline" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Level {index + 1}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {config.description}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Security Best Practices */}
      <Card className="border-accent/30 bg-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-accent">
            <Info className="h-5 w-5" />
            Security Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-safe mt-0.5 shrink-0" />
              <span>
                <strong>Principle of Least Privilege:</strong> Assign users the lowest role that allows them to perform their job functions.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-safe mt-0.5 shrink-0" />
              <span>
                <strong>Regular Audits:</strong> Periodically review user roles and remove access for users who no longer need it.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-safe mt-0.5 shrink-0" />
              <span>
                <strong>Owner Succession:</strong> Ensure there is a succession plan for organization ownership in case the current owner becomes unavailable.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-safe mt-0.5 shrink-0" />
              <span>
                <strong>Use Inspector Role:</strong> For external auditors or compliance checks, use the Inspector role which provides read-only access with export capability.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
