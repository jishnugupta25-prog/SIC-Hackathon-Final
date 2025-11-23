import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, LogOut, BarChart3, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserTracking = {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  crimeCount: number;
  createdAt?: string;
  updatedAt?: string;
  isActive: boolean;
};

export default function AdminUsersTracking() {
  const [, setLocation] = useLocation();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null);

  // Check if admin is authenticated on component mount
  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        const response = await fetch("/api/admin/crimes", {
          credentials: "include",
        });
        if (response.ok) {
          setIsAdminAuthenticated(true);
        } else {
          setIsAdminAuthenticated(false);
          setTimeout(() => {
            setLocation("/login");
          }, 500);
        }
      } catch (error) {
        console.error("Admin auth check failed:", error);
        setIsAdminAuthenticated(false);
        setTimeout(() => {
          setLocation("/login");
        }, 500);
      }
    };

    checkAdminAuth();
  }, [setLocation]);

  // Fetch user tracking data with crime counts
  const { data: usersTrackingData, isLoading: usersTrackingLoading } = useQuery({
    queryKey: ["/api/admin/users-tracking"],
    refetchInterval: autoRefresh ? 3000 : false,
    enabled: isAdminAuthenticated === true,
  });

  const usersTracking: UserTracking[] = Array.isArray(usersTrackingData) ? usersTrackingData : [];

  // Calculate statistics
  const totalUsers = usersTracking.length;
  const activeUsers = usersTracking.filter(u => u.isActive).length;
  const totalCrimes = usersTracking.reduce((sum, u) => sum + u.crimeCount, 0);
  const averageCrimesPerUser = totalUsers > 0 ? (totalCrimes / totalUsers).toFixed(2) : 0;

  if (isAdminAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
            <CardDescription>You do not have access to this page</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/login")} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of registered users and their crime reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30">
            <div
              className={`h-3 w-3 rounded-full ${
                autoRefresh ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-sm font-medium">
              {autoRefresh ? "Live" : "Paused"}
            </span>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
            data-testid="button-toggle-refresh"
          >
            {autoRefresh ? "Pause" : "Resume"}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered in the system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <TrendingUp className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently logged in
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Crimes</CardTitle>
            <BarChart3 className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCrimes}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Reported by all users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Reports/User</CardTitle>
            <BarChart3 className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageCrimesPerUser}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Average crime reports per user
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Registered Users
          </CardTitle>
          <CardDescription>
            Complete user data with account information and crime report counts {autoRefresh && "(auto-updating)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersTrackingLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading user data...</div>
            </div>
          ) : usersTracking.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">No users registered yet</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Crimes Reported</TableHead>
                    <TableHead>Member Since</TableHead>
                    <TableHead className="text-center">Account Created</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersTracking.map((user) => (
                    <TableRow key={user.userId} data-testid={`row-user-${user.userId}`}>
                      <TableCell className="font-medium">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email.split('@')[0]}
                      </TableCell>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-bold">
                          {user.crimeCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.createdAt
                          ? formatDistanceToNow(new Date(user.createdAt), {
                              addSuffix: true,
                            })
                          : "Unknown"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Unknown"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          className={
                            user.isActive
                              ? "bg-green-500/20 text-green-700 dark:text-green-400"
                              : "bg-gray-500/20 text-gray-700 dark:text-gray-400"
                          }
                        >
                          {user.isActive ? "Online" : "Offline"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
