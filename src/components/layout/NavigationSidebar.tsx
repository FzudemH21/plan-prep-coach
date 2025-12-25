import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Home, 
  Target, 
  Calendar, 
  Users, 
  FileText, 
  BarChart3,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Zap,
  Wrench,
  Activity,
  Library
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomLibraries } from "@/contexts/CustomLibrariesContext";

interface NavigationSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  path?: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

export function NavigationSidebar({ open, onOpenChange }: NavigationSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { libraries } = useCustomLibraries();
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    athletes: true,
    templates: true,
  });

  const createSlug = (name: string): string => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const isActive = (path: string) => location.pathname === path;
  const isInGroup = (items: NavItem[]) => items.some(item => isActive(item.path));

  // Build dynamic library items
  const libraryItems: NavItem[] = libraries
    .filter(lib => lib.type === 'custom')
    .map(lib => ({
      title: lib.name,
      path: `/templates/libraries/${createSlug(lib.name)}`,
      icon: Dumbbell
    }));

  const athletesGroup: NavGroup = {
    title: "Athletes",
    icon: Users,
    items: [
      { title: "Athlete Database", path: "/athletes", icon: Users },
    ]
  };

  const templatesGroup: NavGroup = {
    title: "Templates & Library",
    icon: FileText,
    path: "/templates",
    items: [
      { title: "Athleticism Database", path: "/templates/athleticism", icon: Activity },
      { title: "Athleticism Database (v2)", path: "/templates/athleticism-v2", icon: Activity },
      { title: "Training Toolbox", path: "/templates/toolbox", icon: Wrench },
      { title: "Resistance Training", path: "/templates/libraries/resistancetraining", icon: Dumbbell },
      { title: "Plyometrics", path: "/templates/libraries/plyometrics", icon: Zap },
      ...libraryItems,
    ]
  };

  const renderNavItem = (item: NavItem) => (
    <Button
      key={item.path}
      variant="ghost"
      className={cn(
        "w-full justify-start pl-8 h-9",
        isActive(item.path) && "bg-accent text-accent-foreground font-medium"
      )}
      onClick={() => handleNavigate(item.path)}
    >
      <item.icon className="h-4 w-4 mr-2" />
      {item.title}
    </Button>
  );

  const renderNavGroup = (group: NavGroup, key: string) => {
    const isOpen = openGroups[key] ?? false;
    const hasActiveChild = isInGroup(group.items);
    const isHeaderActive = group.path && isActive(group.path);

    return (
      <Collapsible
        key={key}
        open={isOpen || hasActiveChild}
      >
        <div className={cn(
          "flex items-center w-full h-10 rounded-md",
          (isHeaderActive || hasActiveChild) && "text-primary"
        )}>
          <Button
            variant="ghost"
            className="flex-1 justify-start h-10 px-4"
            onClick={() => {
              if (group.path) {
                handleNavigate(group.path);
              }
              toggleGroup(key);
            }}
          >
            <group.icon className="h-4 w-4 mr-2" />
            {group.title}
          </Button>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup(key);
              }}
            >
              {isOpen || hasActiveChild ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-1">
          {group.items.map(renderNavItem)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-left">Navigation</SheetTitle>
        </SheetHeader>
        
        <div className="p-2 space-y-1">
          {/* Home - standalone */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-10",
              isActive("/") && "bg-accent text-accent-foreground font-medium"
            )}
            onClick={() => handleNavigate("/")}
          >
            <Home className="h-4 w-4 mr-2" />
            Home
          </Button>

          {/* Athletes Group */}
          {renderNavGroup(athletesGroup, "athletes")}

          {/* Templates & Library Group */}
          {renderNavGroup(templatesGroup, "templates")}

          {/* Analytics - standalone */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-10",
              isActive("/analytics") && "bg-accent text-accent-foreground font-medium"
            )}
            onClick={() => handleNavigate("/analytics")}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
