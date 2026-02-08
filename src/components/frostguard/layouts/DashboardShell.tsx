import * as React from 'react';
import { cn } from '@/lib/design-system/cn';
import { surface, spacing } from '@/lib/design-system/tokens';
import { SidebarLayout } from '@/lib/components/application-shells/SidebarLayout';
import { PageHeading } from '@/lib/components/headings/PageHeading';

export interface DashboardShellProps extends React.HTMLAttributes<HTMLDivElement> {
  sidebar: React.ReactNode;
  sidebarCollapsed?: boolean;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
}

export function DashboardShell({
  className,
  sidebar,
  sidebarCollapsed,
  title,
  description,
  actions,
  breadcrumbs,
  children,
  ...props
}: DashboardShellProps) {
  return (
    <SidebarLayout sidebar={sidebar} sidebarCollapsed={sidebarCollapsed}>
      <div className={cn(surface.base, 'min-h-full', className)} {...props}>
        <div className={spacing.page}>
          <PageHeading
            title={title}
            description={description}
            actions={actions}
            breadcrumbs={breadcrumbs}
          />
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </SidebarLayout>
  );
}
