import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, FileText, Clock, MapPin, User, TrendingDown, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AdminSession = {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  sessionExpire: string;
};

type AdminReport = {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  crimeType: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  isAnonymous: number;
  createdAt?: string;
};

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

export default function AdminDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch active sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["/api/admin/sessions"],
    refetchInterval: autoRefresh ? 3000 : false, // Refresh every 3 seconds
  });

  // Fetch all crime reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ["/api/admin/reports"],
    refetchInterval: autoRefresh ? 3000 : false, // Refresh every 3 seconds
  });

  // Fetch real-time safety scores by area
  const { data: safetyScoresData, isLoading: safetyScoresLoading } = useQuery({
    queryKey: ["/api/safety-scores"],
    refetchInterval: autoRefresh ? 3000 : false, // Refresh every 3 seconds
  });

  // Fetch user tracking data with crime counts
  const { data: usersTrackingData, isLoading: usersTrackingLoading } = useQuery({
    queryKey: ["/api/admin/users-tracking"],
    refetchInterval: autoRefresh ? 3000 : false, // Refresh every 3 seconds
  });

  const sessions: AdminSession[] = Array.isArray(sessionsData) ? sessionsData : [];
  const reports: AdminReport[] = Array.isArray(reportsData) ? reportsData : [];
  const safetyScores: any[] = Array.isArray(safetyScoresData) ? safetyScoresData : [];
  const usersTracking: UserTracking[] = Array.isArray(usersTrackingData) ? usersTrackingData : [];

  const activeSessions = sessions.filter(
    (s) => new Date(s.sessionExpire) > new Date()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of user sessions and crime reports
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
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {sessions.length} total sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crime Reports</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total reports submitted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <User className="h-4 w-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set([...sessions.map((s) => s.userId), ...reports.map((r) => r.userId)]).size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High-Risk Areas</CardTitle>
            <TrendingDown className="h-4 w-4 text-chart-1" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safetyScores.filter(s => s.tier === "Poor" || s.tier === "Fair").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Areas with low safety scores
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UserCheck className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersTracking.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {usersTracking.filter(u => u.isActive).length} currently active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Active User Sessions
          </CardTitle>
          <CardDescription>
            Users currently logged in {autoRefresh && "(auto-updating)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading sessions...</div>
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">No active sessions</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Session Expires</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSessions.map((session) => (
                  <TableRow key={session.userId} data-testid={`row-session-${session.userId}`}>
                    <TableCell className="font-medium">
                      {session.firstName && session.lastName
                        ? `${session.firstName} ${session.lastName}`
                        : "Anonymous"}
                    </TableCell>
                    <TableCell className="text-sm">{session.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(session.sessionExpire), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Safety Scores by Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Safety Scores by Area
          </CardTitle>
          <CardDescription>
            Real-time safety tiers based on crime counts {autoRefresh && "(auto-updating)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {safetyScoresLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading safety scores...</div>
            </div>
          ) : safetyScores.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">No crime data available</div>
            </div>
          ) : (
            <div className="space-y-3">
              {safetyScores.map((area, index) => {
                const tierColor = {
                  "Excellent": "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
                  "Good": "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
                  "Fair": "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
                  "Poor": "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                };
                const tierTextColor = {
                  "Excellent": "text-green-700 dark:text-green-400",
                  "Good": "text-blue-700 dark:text-blue-400",
                  "Fair": "text-yellow-700 dark:text-yellow-400",
                  "Poor": "text-red-700 dark:text-red-400"
                };
                
                return (
                  <div key={area.areaId} className={`p-4 rounded-lg border-2 ${tierColor[area.tier as keyof typeof tierColor]}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          Area {index + 1}: {area.latitude.toFixed(4)}°, {area.longitude.toFixed(4)}°
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={tierTextColor[area.tier as keyof typeof tierTextColor]}>
                            {area.tier}
                          </Badge>
                          <span className="text-sm font-bold">{area.score}/100</span>
                          <span className="text-xs text-muted-foreground">({area.crimeCount} crimes)</span>
                        </div>
                      </div>
                    </div>
                    {area.recentCrimes.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                        <p className="font-medium mb-1">Recent: {area.recentCrimes.map((c: any) => c.crimeType).join(", ")}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Tracking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Tracking & Crime Reports
          </CardTitle>
          <CardDescription>
            All registered users with their account details and crime report counts {autoRefresh && "(auto-updating)"}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Crimes Reported</TableHead>
                  <TableHead>Member Since</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersTracking.map((user) => (
                  <TableRow key={user.userId} data-testid={`row-user-${user.userId}`}>
                    <TableCell className="font-medium">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : "No Name"}
                    </TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell className="text-center font-semibold">{user.crimeCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.createdAt
                        ? formatDistanceToNow(new Date(user.createdAt), {
                            addSuffix: true,
                          })
                        : "Unknown"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={user.isActive ? "bg-green-500/20 text-green-700 dark:text-green-400" : "bg-gray-500/20 text-gray-700 dark:text-gray-400"}>
                        {user.isActive ? "Online" : "Offline"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Crime Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Recent Crime Reports
          </CardTitle>
          <CardDescription>
            All submitted crime reports {autoRefresh && "(auto-updating)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading reports...</div>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">No reports submitted yet</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Crime Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                      <TableCell className="font-medium">
                        {report.isAnonymous === 1 ? (
                          <Badge variant="secondary">Anonymous</Badge>
                        ) : (
                          report.userName || report.userEmail
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.crimeType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span title={report.address || "Unknown"}>
                            {report.address
                              ? report.address.substring(0, 30) + "..."
                              : `${report.latitude.toFixed(4)}°, ${report.longitude.toFixed(4)}°`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {report.description || "No description"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.createdAt
                          ? formatDistanceToNow(new Date(report.createdAt), {
                              addSuffix: true,
                            })
                          : "Unknown"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-red-500/20 text-red-700 dark:text-red-400">
                          Reported
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
