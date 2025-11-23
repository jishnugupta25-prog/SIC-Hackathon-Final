import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Clock, MessageSquare, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

type CrimeWithApproval = {
  id: string;
  userId: string;
  crimeType: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  isAnonymous: number;
  reportedAt?: string;
  approval?: {
    status: string;
    reviewedAt?: string;
    feedback?: Array<{
      id: string;
      message: string;
    }>;
  };
};

export default function MyCrimeReports() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch user's crime reports
  const { data: crimes = [], isLoading, error } = useQuery<CrimeWithApproval[]>({
    queryKey: ["/api/user/crimes"],
    enabled: isAuthenticated && !authLoading,
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your crime reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Crime Reports</h1>
        <p className="text-muted-foreground mt-1">View your submitted crime reports and admin feedback</p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load your crime reports. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {crimes.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No crime reports found</p>
            <p className="text-sm text-muted-foreground mt-1">
              When you submit a crime report, it will appear here with admin feedback.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {crimes.map((crime: CrimeWithApproval) => (
            <Card key={crime.id} className="overflow-hidden">
              {/* Crime Report Details */}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      {crime.crimeType}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {crime.address || `${crime.latitude.toFixed(4)}°, ${crime.longitude.toFixed(4)}°`}
                    </CardDescription>
                  </div>
                  {crime.approval && (
                    <Badge
                      className={
                        crime.approval.status === "approved"
                          ? "bg-green-500/20 text-green-700 dark:text-green-400"
                          : crime.approval.status === "rejected"
                          ? "bg-red-500/20 text-red-700 dark:text-red-400"
                          : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                      }
                    >
                      {crime.approval.status === "approved"
                        ? "Approved"
                        : crime.approval.status === "rejected"
                        ? "Rejected"
                        : "Pending"}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description */}
                {crime.description && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground">Description</p>
                    <p className="text-sm">{crime.description}</p>
                  </div>
                )}

                {/* Location */}
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Location
                  </p>
                  <p className="text-sm">{crime.address || "Not specified"}</p>
                  <p className="font-mono text-xs text-muted-foreground">{crime.latitude.toFixed(6)}°, {crime.longitude.toFixed(6)}°</p>
                </div>

                {/* Submission Time */}
                <div className="bg-muted/50 p-3 rounded space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Submitted
                  </p>
                  <p className="text-sm">
                    {crime.reportedAt
                      ? new Date(crime.reportedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        })
                      : "Not available"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {crime.reportedAt ? formatDistanceToNow(new Date(crime.reportedAt), { addSuffix: true }) : ""}
                  </p>
                </div>

                {/* Admin Feedback Section */}
                {crime.approval && (
                  <div className="border-t pt-4">
                    <div className="space-y-3">
                      {/* Status with Icon */}
                      <div className="flex items-center gap-2">
                        {crime.approval.status === "approved" ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                            <span className="font-semibold text-green-700 dark:text-green-400">Approved by Admin</span>
                          </>
                        ) : crime.approval.status === "rejected" ? (
                          <>
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            <span className="font-semibold text-red-700 dark:text-red-400">Rejected by Admin</span>
                          </>
                        ) : (
                          <span className="text-sm text-yellow-700 dark:text-yellow-400">Pending Review</span>
                        )}
                      </div>

                      {/* Admin Feedback Messages */}
                      {crime.approval.feedback && crime.approval.feedback.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            Admin Feedback ({crime.approval.feedback.length})
                          </p>
                          <div className="space-y-2 bg-secondary/20 p-3 rounded border-l-4 border-blue-500">
                            {crime.approval.feedback.map((msg: any) => (
                              <div key={msg.id} className="bg-background p-2 rounded border-l-2 border-primary">
                                <p className="text-sm text-foreground">{msg.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
