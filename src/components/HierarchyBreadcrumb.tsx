import { Link, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface BreadcrumbSibling {
  id: string;
  name: string;
  href: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
  siblings?: BreadcrumbSibling[];
}

interface HierarchyBreadcrumbProps {
  items: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function HierarchyBreadcrumb({ items, actions, className }: HierarchyBreadcrumbProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("flex items-center justify-between gap-4 mb-4 w-full", className)}>
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0 flex-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2 shrink-0">
            {index > 0 && (
              <span 
                className="w-0.5 h-4 rounded-full bg-muted-foreground/40 select-none" 
                aria-hidden="true"
              />
            )}
            
            {item.isCurrentPage && item.siblings && item.siblings.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 font-medium text-foreground hover:text-foreground/80 transition-colors focus:outline-none">
                  <span className="truncate max-w-[200px]">{item.label}</span>
                  <ChevronDown className="w-4 h-4 shrink-0" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                  {item.siblings.map((sibling) => (
                    <DropdownMenuItem
                      key={sibling.id}
                      onClick={() => navigate(sibling.href)}
                      className="cursor-pointer"
                    >
                      {sibling.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : item.isCurrentPage ? (
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                to={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-muted-foreground truncate max-w-[150px]">
                {item.label}
              </span>
            )}
          </div>
        ))}
      </nav>
      
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
