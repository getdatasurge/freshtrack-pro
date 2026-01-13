import { Lock, Star, Plus, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_LAYOUT_ID, MAX_CUSTOM_LAYOUTS } from "../types";

interface LayoutOption {
  id: string;
  name: string;
  isDefault: boolean;
  isUserDefault: boolean;
}

interface LayoutSelectorProps {
  availableLayouts: LayoutOption[];
  activeLayoutId: string;
  onSelect: (layoutId: string) => void;
  isDirty: boolean;
  canCreateNew: boolean;
  onCreateNew: () => void;
  layoutCount: number;
  disabled?: boolean;
}

export function LayoutSelector({
  availableLayouts,
  activeLayoutId,
  onSelect,
  isDirty,
  canCreateNew,
  onCreateNew,
  layoutCount,
  disabled,
}: LayoutSelectorProps) {
  const customLayouts = availableLayouts.filter((l) => !l.isDefault);
  const activeLayout = availableLayouts.find((l) => l.id === activeLayoutId);

  return (
    <div className="flex items-center gap-2">
      <Select value={activeLayoutId} onValueChange={onSelect} disabled={disabled}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Select layout">
            <div className="flex items-center gap-2">
              {activeLayoutId === DEFAULT_LAYOUT_ID && (
                <Lock className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="truncate">
                {activeLayout?.name || "Select layout"}
              </span>
              {isDirty && (
                <Badge variant="secondary" className="ml-1 text-xs px-1">
                  Unsaved
                </Badge>
              )}
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Default layout always first */}
          <SelectItem value={DEFAULT_LAYOUT_ID}>
            <div className="flex items-center gap-2">
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span>Default (Recommended)</span>
            </div>
          </SelectItem>

          {customLayouts.length > 0 && <Separator className="my-1" />}

          {/* User's custom layouts */}
          {customLayouts.map((layout) => (
            <SelectItem key={layout.id} value={layout.id}>
              <div className="flex items-center gap-2">
                <span className="truncate">{layout.name}</span>
                {layout.isUserDefault && (
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                )}
              </div>
            </SelectItem>
          ))}

          {/* Create new button */}
          <Separator className="my-1" />
          <div className="px-2 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNew();
              }}
              disabled={!canCreateNew}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Layout ({layoutCount}/{MAX_CUSTOM_LAYOUTS})
            </Button>
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
