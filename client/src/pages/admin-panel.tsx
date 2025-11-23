import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, MapPin, LogOut, CheckCircle, XCircle, MessageSquare, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CrimeForReview = {
  id: string;
  userId: string;
  crimeType: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  isAnonymous: number;
  reportedAt?: string;
  createdAt?: string;
  approval?: {
    status: string;
    reviewedAt?: string;
  };
};

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const [selectedCrimeId, setSelectedCrimeId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
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

  // Fetch crimes for review
  const { data: crimesData, isLoading } = useQuery({
    queryKey: ["/api/admin/crimes"],
    refetchInterval: 3000, // Refresh every 3 seconds
    enabled: isAdminAuthenticated === true, // Only fetch if authenticated
  });

  // Fetch feedback for selected crime
  const { data: crimeFeedback = [] } = useQuery({
    queryKey: [`/api/admin/crimes/${selectedCrimeId}/feedback`],
    enabled: !!selectedCrimeId && isAdminAuthenticated === true,
  });

  const crimes: CrimeForReview[] = Array.isArray(crimesData) ? crimesData : [];
  const selectedCrime = crimes.find((c) => c.id === selectedCrimeId);

  // Approve crime mutation
  const approveMutation = useMutation({
    mutationFn: async (crimeId: string) => {
      return apiRequest("POST", `/api/admin/approve/${crimeId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crimes"] });
    },
  });

  // Reject crime mutation
  const rejectMutation = useMutation({
    mutationFn: async (crimeId: string) => {
      return apiRequest("POST", `/api/admin/reject/${crimeId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crimes"] });
    },
  });

  // Send feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCrimeId) return;
      return apiRequest("POST", "/api/admin/feedback", {
        crimeId: selectedCrimeId,
        message: feedbackMessage,
      });
    },
    onSuccess: () => {
      setFeedbackMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crimes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/crimes/${selectedCrimeId}/feedback`] });
    },
  });

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "GET", credentials: "include" });
    setLocation("/login");
  };

  const handleSendFeedback = async () => {
    if (!feedbackMessage.trim() || !selectedCrimeId) return;
    setFeedbackLoading(true);
    try {
      await feedbackMutation.mutateAsync();
    } finally {
      setFeedbackLoading(false);
    }
  };

  const pendingCrimes = crimes.filter((c) => !c.approval || c.approval.status === "pending");
  const approvedCrimes = crimes.filter((c) => c.approval?.status === "approved");
  const rejectedCrimes = crimes.filter((c) => c.approval?.status === "rejected");

  // Show loading state while checking admin authentication
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

  // Show error state if not authenticated
  if (isAdminAuthenticated === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md p-6">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              Admin authentication failed. Please log in again.
            </p>
            <Button onClick={() => setLocation("/login")}>
              Return to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">Review and manage crime reports</p>
        </div>
        <Button variant="destructive" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCrimes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCrimes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedCrimes.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Crimes List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Crime Reports
              </CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${crimes.length} reports total`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center text-muted-foreground py-8">Loading reports...</div>
              ) : crimes.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No reports found</div>
              ) : (
                <div className="space-y-2">
                  {crimes.map((crime) => (
                    <div
                      key={crime.id}
                      onClick={() => setSelectedCrimeId(crime.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedCrimeId === crime.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid={`card-crime-${crime.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold">{crime.crimeType}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {crime.address || `${crime.latitude.toFixed(4)}°, ${crime.longitude.toFixed(4)}°`}
                          </p>
                          {(crime as any).reporter && (
                            <p className="text-xs text-muted-foreground mt-1">
                              By: {(crime as any).reporter.firstName} {(crime as any).reporter.lastName}
                            </p>
                          )}
                        </div>
                        <Badge
                          className={
                            crime.approval?.status === "approved"
                              ? "bg-green-500/20 text-green-700 dark:text-green-400"
                              : crime.approval?.status === "rejected"
                              ? "bg-red-500/20 text-red-700 dark:text-red-400"
                              : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                          }
                        >
                          {crime.approval?.status === "approved"
                            ? "Approved"
                            : crime.approval?.status === "rejected"
                            ? "Rejected"
                            : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {crime.reportedAt
                          ? formatDistanceToNow(new Date(crime.reportedAt), { addSuffix: true })
                          : "Unknown"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          {selectedCrime ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Report Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(selectedCrime as any).reporter && (
                    <>
                      <div className="bg-secondary/50 p-3 rounded-lg">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Reporter Information</p>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Name</p>
                            <p className="text-sm font-semibold">{(selectedCrime as any).reporter.firstName} {(selectedCrime as any).reporter.lastName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-sm">{(selectedCrime as any).reporter.email}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Crime Type</p>
                    <p className="text-sm font-semibold mt-1">{selectedCrime.crimeType}</p>
                  </div>
                  {selectedCrime.description && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Description</p>
                      <p className="text-sm mt-1">{selectedCrime.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Location Address</p>
                    <p className="text-sm mt-1">{selectedCrime.address || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Exact Coordinates</p>
                    <p className="text-sm mt-1 font-mono text-xs">{selectedCrime.latitude.toFixed(6)}°, {selectedCrime.longitude.toFixed(6)}°</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Submission Time
                    </p>
                    <div className="mt-2 bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Exact Time</p>
                      <p className="text-sm font-mono">
                        {selectedCrime.reportedAt
                          ? new Date(selectedCrime.reportedAt).toLocaleString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: true,
                            })
                          : "Not available"}
                      </p>
                      {selectedCrime.reportedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(selectedCrime.reportedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Status</p>
                    <Badge
                      className={`mt-1 ${
                        selectedCrime.approval?.status === "approved"
                          ? "bg-green-500/20 text-green-700 dark:text-green-400"
                          : selectedCrime.approval?.status === "rejected"
                          ? "bg-red-500/20 text-red-700 dark:text-red-400"
                          : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                      }`}
                    >
                      {selectedCrime.approval?.status === "approved"
                        ? "Approved"
                        : selectedCrime.approval?.status === "rejected"
                        ? "Rejected"
                        : "Pending"}
                    </Badge>
                  </div>

                  {(!selectedCrime.approval || selectedCrime.approval.status === "pending") && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveMutation.mutate(selectedCrime.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        disabled={approveMutation.isPending}
                        data-testid="button-approve"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => rejectMutation.mutate(selectedCrime.id)}
                        variant="destructive"
                        className="flex-1"
                        disabled={rejectMutation.isPending}
                        data-testid="button-reject"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {/* Feedback Section */}
                  <div className="border-t pt-4 mt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Feedback Messages ({Array.isArray(crimeFeedback) ? crimeFeedback.length : 0})
                    </p>
                    
                    {Array.isArray(crimeFeedback) && crimeFeedback.length > 0 && (
                      <div className="space-y-2 mb-4 bg-secondary/30 p-3 rounded-lg">
                        {crimeFeedback.map((feedback: any) => (
                          <div key={feedback.id} className="bg-background p-2 rounded border-l-2 border-blue-500">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-xs font-semibold">System Admin</p>
                              <p className="text-xs text-muted-foreground">
                                {feedback.createdAt ? new Date(feedback.createdAt).toLocaleDateString() : ""}
                              </p>
                            </div>
                            <p className="text-sm text-foreground">{feedback.message}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <Textarea
                      placeholder="Type your feedback message..."
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      className="resize-none mb-2"
                      data-testid="textarea-feedback"
                    />
                    <Button
                      onClick={handleSendFeedback}
                      disabled={feedbackLoading || !feedbackMessage.trim()}
                      className="w-full"
                      size="sm"
                      data-testid="button-send-feedback"
                    >
                      {feedbackLoading ? "Sending..." : "Send Feedback"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
                Select a report to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
