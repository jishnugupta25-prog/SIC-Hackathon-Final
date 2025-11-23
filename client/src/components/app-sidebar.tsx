import { Home, Map, AlertTriangle, Shield, Users, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Crime Map",
    url: "/crime-map",
    icon: Map,
  },
  {
    title: "Report Crime",
    url: "/report-crime",
    icon: AlertTriangle,
  },
  {
    title: "Safe Places",
    url: "/safe-places",
    icon: Shield,
  },
  {
    title: "My Reports",
    url: "/my-reports",
    icon: AlertTriangle,
  },
  {
    title: "Emergency Contacts",
    url: "/contacts",
    icon: Users,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <Sidebar className="border-r-2 border-primary/20">
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-heading font-bold flex items-center gap-2 px-4 py-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg mb-4">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-primary">Crime Portal</span>
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <SidebarMenu className="space-y-2">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`} className={`px-4 py-3 rounded-lg transition-all ${location === item.url ? 'bg-primary/15 text-primary font-semibold' : 'hover:bg-primary/5'}`}>
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4 p-3 bg-sidebar-accent/30 rounded-lg">
          <Avatar className="h-10 w-10 ring-2 ring-primary/30">
            <AvatarImage src={user?.profileImageUrl || undefined} className="object-cover" />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold">{getUserInitials()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" data-testid="text-user-name">
              {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || "User"}
            </p>
            {user?.email && (
              <p className="text-xs text-sidebar-foreground/60 truncate">{user.email}</p>
            )}
          </div>
        </div>
        <Button variant="outline" className="w-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50" asChild data-testid="button-logout">
          <a href="/api/auth/logout">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </a>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
