import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, FileText, Clock, MapPin, User } from "lucide-react";
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

  const sessions: AdminSession[] = Array.isArray(sessionsData) ? sessionsData : [];
  const reports: AdminReport[] = Array.isArray(reportsData) ? reportsData : [];

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
