import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, MapPin, LogOut, CheckCircle, XCircle, MessageSquare, Clock, X, Navigation, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";

type CrimeForReview = {
  id: string;
  userId: string;
  crimeType: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  phoneNumber?: string;
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
  const { toast } = useToast();
  const [selectedCrimeId, setSelectedCrimeId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      toast({
        title: "Report Approved",
        description: "report approved!",
        duration: 3000,
      });
      // Don't close modal - user must submit feedback first
    },
  });

  // Reject crime mutation
  const rejectMutation = useMutation({
    mutationFn: async (crimeId: string) => {
      return apiRequest("POST", `/api/admin/reject/${crimeId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crimes"] });
      toast({
        title: "Report Rejected",
        description: "report rejected!",
        duration: 3000,
      });
      // Don't close modal - user must submit feedback first
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
      toast({
        title: "Feedback Submitted",
        description: "feedback submitted!",
        duration: 3000,
      });
      // Close modal only after feedback is submitted
      setIsModalOpen(false);
      setSelectedCrimeId(null);
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

  const handleSelectCrime = (crimeId: string) => {
    setSelectedCrimeId(crimeId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCrimeId(null);
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="destructive" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
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

      {/* Crime Reports List */}
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
                  onClick={() => handleSelectCrime(crime.id)}
                  className="p-4 rounded-lg border-2 border-border cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"
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
                          By: {crime.isAnonymous ? "Anonymous User" : `${(crime as any).reporter.firstName} ${(crime as any).reporter.lastName}`}
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

      {/* Report Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-report-details">
          {selectedCrime ? (
            <>
              <DialogHeader className="pb-2 flex-shrink-0">
                <DialogTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {selectedCrime.crimeType}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedCrime.reportedAt
                    ? new Date(selectedCrime.reportedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "Unknown"}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="pr-4 space-y-2 pb-4">
                  {/* Quick Status & Action */}
                  <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                    <Badge
                      className={
                        selectedCrime.approval?.status === "approved"
                          ? "bg-green-500/20 text-green-700 dark:text-green-400 text-xs"
                          : selectedCrime.approval?.status === "rejected"
                          ? "bg-red-500/20 text-red-700 dark:text-red-400 text-xs"
                          : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs"
                      }
                    >
                      {selectedCrime.approval?.status === "approved"
                        ? "Approved"
                        : selectedCrime.approval?.status === "rejected"
                        ? "Rejected"
                        : "Pending"}
                    </Badge>
                    {(!selectedCrime.approval || selectedCrime.approval.status === "pending") && (
                      <div className="flex gap-1">
                        <Button
                          onClick={() => approveMutation.mutate(selectedCrime.id)}
                          className="h-8 px-3 bg-green-600 hover:bg-green-700 text-xs"
                          disabled={approveMutation.isPending}
                          data-testid="button-approve"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => rejectMutation.mutate(selectedCrime.id)}
                          className="h-8 px-3 bg-red-600 hover:bg-red-700 text-xs"
                          disabled={rejectMutation.isPending}
                          data-testid="button-reject"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Reporter Info - Compact */}
                  {(selectedCrime as any).reporter && (
                    <div className="bg-secondary/30 p-2 rounded text-xs space-y-2">
                      {selectedCrime.isAnonymous ? (
                        <p className="font-semibold">Anonymous User</p>
                      ) : (
                        <>
                          <p className="font-semibold">{(selectedCrime as any).reporter.firstName} {(selectedCrime as any).reporter.lastName}</p>
                          <p className="text-muted-foreground break-all">{(selectedCrime as any).reporter.email}</p>
                          {selectedCrime.phoneNumber && (
                            <div className="space-y-1">
                              <p className="text-muted-foreground break-all font-mono">{selectedCrime.phoneNumber}</p>
                              <Button
                                onClick={() => {
                                  window.location.href = `tel:${selectedCrime.phoneNumber}`;
                                }}
                                variant="outline"
                                className="w-full h-7 text-xs"
                                data-testid="button-call-user"
                              >
                                <Phone className="h-3 w-3 mr-1" />
                                Call User
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {selectedCrime.description && (
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-muted-foreground">Description</p>
                      <p className="text-sm">{selectedCrime.description}</p>
                    </div>
                  )}

                  {/* Location & Coordinates with Directions */}
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-muted-foreground">Location</p>
                    <p className="text-sm">{selectedCrime.address || "Not specified"}</p>
                    <p className="font-mono text-xs text-muted-foreground">{selectedCrime.latitude.toFixed(6)}°, {selectedCrime.longitude.toFixed(6)}°</p>
                    <Button
                      onClick={() => {
                        window.open(
                          `https://www.google.com/maps/search/?api=1&query=${selectedCrime.latitude},${selectedCrime.longitude}`,
                          "_blank"
                        );
                      }}
                      variant="outline"
                      className="w-full h-7 mt-2 text-xs"
                      data-testid="button-directions"
                    >
                      <Navigation className="h-3 w-3 mr-1" />
                      Directions
                    </Button>
                  </div>

                  {/* Submission Time - Compact */}
                  <div className="bg-muted/50 p-2 rounded text-xs space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {selectedCrime.reportedAt
                        ? new Date(selectedCrime.reportedAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: true,
                          })
                        : "Not available"}
                    </p>
                  </div>

                  {/* Feedback Section - Compact */}
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Feedback ({Array.isArray(crimeFeedback) ? crimeFeedback.length : 0})
                    </p>
                    
                    {Array.isArray(crimeFeedback) && crimeFeedback.length > 0 && (
                      <div className="space-y-1 mb-2 bg-secondary/20 p-2 rounded max-h-20 overflow-y-auto">
                        {crimeFeedback.map((feedback: any) => (
                          <div key={feedback.id} className="bg-background p-1 rounded border-l-2 border-blue-500 text-xs">
                            <p className="text-xs text-foreground">{feedback.message}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <Textarea
                      placeholder="Add feedback..."
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      className="resize-none mb-2 text-xs h-20"
                      data-testid="textarea-feedback"
                    />
                    <Button
                      onClick={handleSendFeedback}
                      disabled={feedbackLoading || !feedbackMessage.trim()}
                      className="w-full h-8 text-xs"
                      size="sm"
                      data-testid="button-send-feedback"
                    >
                      {feedbackLoading ? "Sending..." : "Send Feedback"}
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
