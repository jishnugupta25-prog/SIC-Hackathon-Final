import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Users, Shield, AlertCircle, MessageSquare } from "lucide-react";
import crimeDashboardImg from "@assets/generated_images/crime_dashboard_ui_concept.png";
import protectionShieldImg from "@assets/generated_images/protection_shield_badge.png";
import type { EmergencyContact, CrimeReport } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Home() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [sosActive, setSosActive] = useState(false);
  const [sosCounter, setSosCounter] = useState(0);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

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

  // Fetch emergency contacts
  const { data: contacts = [] } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
  });

  // Calculate safety score based on crime count
  const calculateSafetyScore = (crimeCount: number) => {
    if (crimeCount === 0) return { label: "Excellent", color: "text-chart-1" };
    if (crimeCount <= 5) return { label: "Excellent", color: "text-chart-1" };
    if (crimeCount <= 15) return { label: "Good", color: "text-chart-4" };
    if (crimeCount <= 30) return { label: "Fair", color: "text-chart-2" };
    return { label: "Poor", color: "text-destructive" };
  };

  // Fetch recent crime reports with polling for real-time updates
  const { data: recentCrimes = [] } = useQuery<CrimeReport[]>({
    queryKey: ["/api/crimes/recent"],
    enabled: isAuthenticated,
    refetchInterval: 5000, // Poll every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  });

  // Fetch admin feedback messages
  const { data: feedbackMessages = [] } = useQuery<any[]>({
    queryKey: ["/api/user/feedback"],
    enabled: isAuthenticated,
    refetchInterval: 5000, // Poll for new messages
  });

  // SOS Alert mutation
  const sosMutation = useMutation({
    mutationFn: async () => {
      if (!location) {
        throw new Error("Location not available");
      }
      return await apiRequest("POST", "/api/sos", {
        latitude: location.latitude,
        longitude: location.longitude,
      });
    },
    onSuccess: () => {
      toast({
        title: "SOS Alert Sent!",
        description: `Emergency message sent to ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`,
      });
      setSosActive(false);
      setSosCounter(0);
      setShowSosConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/sos-history"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "SOS Failed",
        description: error.message || "Failed to send SOS alert",
        variant: "destructive",
      });
    },
  });

  // Get current location with fallback
  useEffect(() => {
    // Fallback location (center of India)
    const fallbackLocation = { latitude: 20.5937, longitude: 78.9629 };

    if (!navigator.geolocation) {
      console.warn("Geolocation not available, using fallback location");
      setLocation(fallbackLocation);
      return;
    }

    const options = {
      enableHighAccuracy: true, // Enable high accuracy for ±2-3 meters precision
      timeout: 60000, // 60 seconds for satellite lock and maximum accuracy
      maximumAge: 0, // Always get fresh readings
    };

    console.log("Requesting SOS location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        console.log("SOS location obtained:", newLocation);
        setLocation(newLocation);
      },
      (error) => {
        console.error("Geolocation error for SOS:", error.code, error.message);
        console.log("Using fallback location for SOS");
        setLocation(fallbackLocation);
      },
      options
    );
  }, []);

  // Handle SOS button click
  const handleSosClick = () => {
    if (contacts.length === 0) {
      toast({
        title: "No Emergency Contacts",
        description: "Please add emergency contacts before using SOS",
        variant: "destructive",
      });
      return;
    }

    if (!location) {
      toast({
        title: "Location Unavailable",
        description: "Unable to get your current location",
        variant: "destructive",
      });
      return;
    }

    const newCounter = sosCounter + 1;
    setSosCounter(newCounter);

    if (newCounter === 1) {
      setSosActive(true);
      toast({
        title: "SOS Activated",
        description: "Tap once more to send emergency alert",
      });
      setTimeout(() => {
        setSosCounter(0);
        setSosActive(false);
      }, 3000);
    } else if (newCounter === 2) {
      setShowSosConfirm(true);
    }
  };

  const confirmSos = () => {
    sosMutation.mutate();
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Decorative background images */}
      <div className="fixed bottom-0 right-0 opacity-5 pointer-events-none z-0 max-w-sm">
        <img src={crimeDashboardImg} alt="" className="w-full h-auto" />
      </div>
      <div className="fixed top-32 left-4 opacity-8 pointer-events-none z-0 max-w-xs">
        <img src={protectionShieldImg} alt="" className="w-24 h-24" />
      </div>

      {/* Emergency Helpline */}
      <div className="fixed top-4 right-4 z-40 md:top-6 md:right-6">
        <a 
          href="tel:112"
          className="group block"
          data-testid="helpline-112"
        >
          <div className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover-elevate">
            <p className="text-sm font-semibold text-foreground whitespace-nowrap">
              Emergency Helpline Number For India -{" "}
              <span className="text-destructive">112</span>
            </p>
          </div>
        </a>
      </div>

      {/* Welcome Header */}
      <div className="relative z-10">
        <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-tight">
          Welcome back, {user?.firstName || "User"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Your personal safety dashboard
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 relative z-10">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emergency Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-contact-count">{contacts.length}</div>
            <p className="text-xs text-muted-foreground">Ready to receive SOS</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Reports</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-crime-count">{recentCrimes.length}</div>
            <p className="text-xs text-muted-foreground">In your area (7 days)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Location Status</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {location ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">GPS tracking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Safety Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${calculateSafetyScore(recentCrimes.length).color}`} data-testid="text-safety-score">
              {calculateSafetyScore(recentCrimes.length).label}
            </div>
            <p className="text-xs text-muted-foreground">Based on {recentCrimes.length} crime{recentCrimes.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* SOS Button Section */}
      <Card className="border-destructive/50 relative z-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Emergency SOS
          </CardTitle>
          <CardDescription>
            Tap the button twice to send an emergency alert to all your contacts
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pt-4">
          <button
            onClick={handleSosClick}
            disabled={sosMutation.isPending || contacts.length === 0}
            className={`
              h-32 w-32 rounded-full flex items-center justify-center
              transition-all duration-200 cursor-pointer
              ${sosActive 
                ? 'bg-destructive animate-pulse shadow-lg shadow-destructive/50' 
                : 'bg-destructive/90 hover-elevate active-elevate-2'
              }
              ${contacts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            data-testid="button-sos"
          >
            <AlertTriangle className="h-16 w-16 text-destructive-foreground" />
          </button>
          <div className="text-center">
            <p className="text-sm font-medium">
              {sosActive ? "Tap once more to activate" : "Tap twice for emergency"}
            </p>
            {contacts.length === 0 && (
              <p className="text-xs text-destructive mt-1">Add emergency contacts first</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin Feedback Messages */}
      {feedbackMessages.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 relative z-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Messages from System Admin
            </CardTitle>
            <CardDescription>
              Feedback on your crime reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedbackMessages.map((feedback: any) => (
                <div key={feedback.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg border-l-4 border-blue-500">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-sm">System Admin</p>
                    <span className="text-xs text-muted-foreground">
                      {feedback.createdAt ? new Date(feedback.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{feedback.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 relative z-10">
        <Card className="hover-elevate cursor-pointer" data-testid="card-quick-report">
          <CardHeader>
            <CardTitle className="text-lg">Report a Crime</CardTitle>
            <CardDescription>Quickly submit a crime report with your location</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" data-testid="button-report-crime">
              <a href="/report-crime">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Report Now
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate cursor-pointer" data-testid="card-quick-map">
          <CardHeader>
            <CardTitle className="text-lg">View Crime Map</CardTitle>
            <CardDescription>See crimes reported in your neighborhood</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full" data-testid="button-view-map">
              <a href="/crime-map">
                <MapPin className="h-4 w-4 mr-2" />
                View Map
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* SOS Confirmation Dialog */}
      <AlertDialog open={showSosConfirm} onOpenChange={setShowSosConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Emergency Alert?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send your current location to {contacts.length} emergency contact{contacts.length !== 1 ? 's' : ''} via SMS.
              They will receive: "User {user?.firstName || user?.email} needs urgent help!"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSosCounter(0); setSosActive(false); }} data-testid="button-cancel-sos">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSos} className="bg-destructive hover:bg-destructive/90" data-testid="button-confirm-sos">
              Send SOS Alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
