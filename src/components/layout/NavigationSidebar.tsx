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
  Library,
  UserCircle,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCustomLibraries } from "@/contexts/CustomLibrariesContext";
import { useAuth } from "@/hooks/useAuth";

interface NavigationSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
}

interface NavSubGroup {
  title: string;
  icon: React.ElementType;
  key: string;
  items: NavItem[];
}

interface NavGroup {
  title: string;
  icon: React.ElementType;
  path?: string;
  items: NavItem[];
  subGroups?: NavSubGroup[];
  defaultOpen?: boolean;
}

export function NavigationSidebar({ open, onOpenChange }: NavigationSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { libraries } = useCustomLibraries();
  const { signOut, user } = useAuth();
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    templates: true,
    exerciseLibraries: false,
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

  const isInGroup = (items: NavItem[], subGroups?: NavSubGroup[]) => {
    const itemsActive = items.some(item => isActive(item.path));
    const subGroupsActive = subGroups?.some(sg => sg.items.some(item => isActive(item.path))) ?? false;
    return itemsActive || subGroupsActive;
  };

  // Build library items from user-created libraries
  const exerciseLibraryItems: NavItem[] = libraries.map(lib => ({
    title: lib.name,
    path: `/templates/libraries/${lib.id}`,
    icon: Library
  }));

  const templatesGroup: NavGroup = {
    title: "Templates & Libraries",
    icon: FileText,
    path: "/templates",
    items: [
      { title: "Training Programs", path: "/templates/programs", icon: Calendar },
    ],
    subGroups: [
      {
        title: "Exercise Libraries",
        icon: Library,
        key: "exerciseLibraries",
        items: exerciseLibraryItems
      }
    ]
  };

  const renderNavItem = (item: NavItem, extraIndent: boolean = false) => (
    <Button
      key={item.path}
      variant="ghost"
      className={cn(
        "w-full justify-start h-9",
        extraIndent ? "pl-12" : "pl-8",
        isActive(item.path) && "bg-accent text-accent-foreground font-medium"
      )}
      onClick={() => handleNavigate(item.path)}
    >
      <item.icon className="h-4 w-4 mr-2" />
      {item.title}
    </Button>
  );

  const renderNavSubGroup = (subGroup: NavSubGroup) => {
    const isOpen = openGroups[subGroup.key] ?? false;
    const hasActiveChild = subGroup.items.some(item => isActive(item.path));

    return (
      <Collapsible key={subGroup.key} open={isOpen || hasActiveChild}>
        <div className="flex items-center w-full h-9 rounded-md pl-4">
          <Button
            variant="ghost"
            className="flex-1 justify-start h-9 px-4"
            onClick={() => toggleGroup(subGroup.key)}
          >
            <subGroup.icon className="h-4 w-4 mr-2" />
            {subGroup.title}
          </Button>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleGroup(subGroup.key);
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
          {subGroup.items.map((item) => renderNavItem(item, true))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const renderNavGroup = (group: NavGroup, key: string) => {
    const isOpen = openGroups[key] ?? false;
    const hasActiveChild = isInGroup(group.items, group.subGroups);
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
          {group.items.map((item) => renderNavItem(item))}
          {group.subGroups?.map((subGroup) => renderNavSubGroup(subGroup))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-left">Navigation</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
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

          {/* Athlete Database - standalone */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-10",
              isActive("/athletes") && "bg-accent text-accent-foreground font-medium"
            )}
            onClick={() => handleNavigate("/athletes")}
          >
            <Users className="h-4 w-4 mr-2" />
            Athlete Database
          </Button>

          {/* Training Toolbox - standalone */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-10",
              isActive("/templates/toolbox") && "bg-accent text-accent-foreground font-medium"
            )}
            onClick={() => handleNavigate("/templates/toolbox")}
          >
            <Wrench className="h-4 w-4 mr-2" />
            Training Toolbox
          </Button>

          {/* Parameter Database - standalone */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-10",
              isActive("/templates/athleticism") && "bg-accent text-accent-foreground font-medium"
            )}
            onClick={() => handleNavigate("/templates/athleticism")}
          >
            <Target className="h-4 w-4 mr-2" />
            Parameter Database
          </Button>

          {/* Templates & Libraries Group */}
          {renderNavGroup(templatesGroup, "templates")}

          {/* Coach-Profil - standalone */}
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-10",
              isActive("/coach-profile") && "bg-accent text-accent-foreground font-medium"
            )}
            onClick={() => handleNavigate("/coach-profile")}
          >
            <UserCircle className="h-4 w-4 mr-2" />
            Coach-Profil
          </Button>

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

        {/* Sign out — pinned to the bottom */}
        <div className="border-t p-2">
          {user?.email && (
            <p className="px-2 py-1 text-xs text-muted-foreground truncate">{user.email}</p>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start h-10 text-muted-foreground hover:text-destructive"
            onClick={async () => {
              await signOut();
              onOpenChange(false);
              navigate("/login", { replace: true });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
