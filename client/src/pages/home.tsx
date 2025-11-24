import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useGlobalVoiceCommands } from "@/context/VoiceCommandContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, MapPin, Users, Shield, AlertCircle, AlertOctagon, Mic } from "lucide-react";
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
  const [, setNavigateLocation] = useLocation();
  const [sosActive, setSosActive] = useState(false);
  const [sosCounter, setSosCounter] = useState(0);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dangerZoneAlert, setDangerZoneAlert] = useState<{ message: string; crimeCount: number } | null>(null);
  const [alertShown, setAlertShown] = useState<string>("");  // Track which hotspots we've alerted about

  // Fetch emergency contacts
  const { data: contacts = [] } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
  });

  // Use global voice commands
  const { isListening, setEmergencyContacts, isVoiceEnabled, setVoiceEnabled } = useGlobalVoiceCommands();

  // Update global voice commands with emergency contacts
  useEffect(() => {
    setEmergencyContacts(contacts);
  }, [contacts, setEmergencyContacts]);

  // Listen for global voice commands
  useEffect(() => {
    const handleVoiceCommand = (event: any) => {
      const keyword = event.detail.keyword;
      console.log(`[Home] Voice command detected: "${keyword}"`);
      toast({
        title: "Voice Command Detected",
        description: `Activating SOS via voice: "${keyword}"`,
      });
      
      if (contacts.length === 0) {
        toast({
          title: "No Emergency Contacts",
          description: "Please add emergency contacts before using SOS",
          variant: "destructive",
        });
        return;
      }
      
      if (location) {
        confirmSosViaVoice();
      } else {
        toast({
          title: "Location Unavailable",
          description: "Unable to get your current location",
          variant: "destructive",
        });
      }
    };

    window.addEventListener('voiceCommandDetected', handleVoiceCommand);
    return () => window.removeEventListener('voiceCommandDetected', handleVoiceCommand);
  }, [contacts, location, toast]);

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

  // Calculate safety score based on crime count
  const calculateSafetyScore = (crimeCount: number) => {
    if (crimeCount === 0) return { label: "Excellent", color: "text-chart-1" };
    if (crimeCount <= 5) return { label: "Excellent", color: "text-chart-1" };
    if (crimeCount <= 15) return { label: "Good", color: "text-chart-4" };
    if (crimeCount <= 30) return { label: "Fair", color: "text-chart-2" };
    return { label: "Poor", color: "text-destructive" };
  };

  // Calculate distance between two coordinates (in kilometers)
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Detect crime hotspots (clusters of crimes)
  const detectCrimeHotspots = () => {
    if (recentCrimes.length < 2) return [];

    // Group crimes within 0.5km radius into hotspots
    const hotspots: Array<{ lat: number; lon: number; crimes: CrimeReport[] }> = [];
    const processed = new Set<string>();

    recentCrimes.forEach((crime) => {
      const crimeId = crime.id;
      if (processed.has(crimeId)) return;

      const nearby = recentCrimes.filter(
        (other) =>
          !processed.has(other.id) &&
          calculateDistance(crime.latitude, crime.longitude, other.latitude, other.longitude) <
            0.5
      );

      if (nearby.length > 0) {
        // Calculate centroid of crimes
        const avgLat =
          nearby.reduce((sum, c) => sum + c.latitude, 0) / nearby.length;
        const avgLon =
          nearby.reduce((sum, c) => sum + c.longitude, 0) / nearby.length;

        hotspots.push({
          lat: avgLat,
          lon: avgLon,
          crimes: nearby,
        });

        nearby.forEach((c) => processed.add(c.id));
      }
    });

    return hotspots;
  };

  // Fetch recent crime reports with polling for real-time updates
  const { data: recentCrimes = [] } = useQuery<CrimeReport[]>({
    queryKey: ["/api/crimes/recent"],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Poll every 30 seconds for real-time updates
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  });


  // Removed SOS Alert mutation - now handled in SOS messaging page

  // Get current location with fallback
  useEffect(() => {
    // Fallback location (center of India)
    const fallbackLocation = { latitude: 20.5937, longitude: 78.9629 };

    if (!navigator.geolocation) {
      console.warn("Geolocation not available, using fallback location");
      setLocation(fallbackLocation);
      return;
    }

    let watchId: number | null = null;
    let bestAccuracy = Infinity;
    let bestPosition: { latitude: number; longitude: number } | null = null;
    let timeoutId: NodeJS.Timeout;

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    console.log("[SOS GPS] Requesting location with improved accuracy...");

    // Watch for location updates
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        console.log(`[SOS GPS] Reading: ±${Math.round(accuracy)}m accuracy`);

        // Keep track of the best reading
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestPosition = newLocation;
          console.log(`[SOS GPS] ✓ Better accuracy found: ±${Math.round(accuracy)}m`);
        }

        // Accept reading if accuracy is good (< 100m)
        if (accuracy < 100) {
          console.log(`[SOS GPS] ✓ Excellent accuracy achieved: ±${Math.round(accuracy)}m`);
          setLocation(newLocation);
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
          clearTimeout(timeoutId);
        }
      },
      (error) => {
        console.error("[SOS GPS] Error:", error.code, error.message);
        // Use best position found so far or fallback
        if (bestPosition) {
          console.log(`[SOS GPS] Using best reading found: ±${Math.round(bestAccuracy)}m`);
          setLocation(bestPosition);
        } else {
          console.log("[SOS GPS] Using fallback location");
          setLocation(fallbackLocation);
        }
      },
      options
    );

    // Timeout after 30 seconds - use best reading found
    timeoutId = setTimeout(() => {
      console.log("[SOS GPS] Timeout reached");
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (bestPosition) {
        console.log(`[SOS GPS] Using best reading found: ±${Math.round(bestAccuracy)}m`);
        setLocation(bestPosition);
      } else {
        console.log("[SOS GPS] Using fallback location");
        setLocation(fallbackLocation);
      }
    }, 30000);

    // Cleanup on unmount
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearTimeout(timeoutId);
    };
  }, []);

  // Monitor for entry into high-crime areas (predictive safety alerts)
  useEffect(() => {
    if (!location || recentCrimes.length === 0) {
      setDangerZoneAlert(null);
      return;
    }

    const hotspots = detectCrimeHotspots();
    
    // Check if user is in a danger zone (within 1km of a high-crime hotspot)
    const dangerZone = hotspots.find((hotspot) => {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        hotspot.lat,
        hotspot.lon
      );
      return distance < 1 && hotspot.crimes.length >= 3; // High-crime area has 3+ crimes
    });

    if (dangerZone) {
      const hotspotId = `${dangerZone.lat}-${dangerZone.lon}`;
      
      // Only show alert if we haven't shown it for this hotspot recently
      if (alertShown !== hotspotId) {
        setDangerZoneAlert({
          message: `⚠️ High-crime area detected! ${dangerZone.crimes.length} recent crimes nearby. Stay alert.`,
          crimeCount: dangerZone.crimes.length,
        });
        setAlertShown(hotspotId);

        // Show toast notification
        toast({
          title: "⚠️ Danger Zone Alert",
          description: `You're entering a high-crime area with ${dangerZone.crimes.length} recent incidents. Stay alert and avoid if possible.`,
          variant: "destructive",
        });
      }
    } else {
      setDangerZoneAlert(null);
    }
  }, [location, recentCrimes, alertShown, toast]);

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

  // Reusable SOS confirmation logic
  const executeSos = () => {
    // Open native SMS app with pre-filled recipients and message
    if (!location) {
      toast({
        title: "Location Error",
        description: "Unable to get location for SOS message",
        variant: "destructive",
      });
      return;
    }

    // Build phone numbers list - format with +91 if needed
    const phoneNumbers = contacts
      .map((contact) => {
        const phone = contact.phoneNumber.replace(/[^\d+]/g, ""); // Remove formatting
        // Add +91 if not present
        return phone.startsWith("+") ? phone : `+91${phone.replace(/^0+/, "")}`;
      })
      .join(",");

    // Build message with location and user info
    const message = `I am in danger save me!!

📍 Location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
👤 From: ${user?.firstName || user?.email}`;

    // Create SMS URI
    const smsUri = `sms:${phoneNumbers}?body=${encodeURIComponent(message)}`;

    console.log("[SOS] Opening native SMS app with URI:", smsUri);

    // Open the native SMS app
    window.location.href = smsUri;

    // Log the SOS alert to history (fire and forget, don't wait)
    apiRequest("POST", "/api/sos", {
      latitude: location.latitude,
      longitude: location.longitude,
    }).catch((error) => {
      console.error("[SOS] Failed to log SOS alert:", error);
    });

    toast({
      title: "SOS Activated",
      description: `Opening SMS app to send alert to ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`,
    });
  };

  const confirmSos = () => {
    setSosActive(false);
    setSosCounter(0);
    setShowSosConfirm(false);
    executeSos();
  };

  const confirmSosViaVoice = () => {
    setSosActive(false);
    setSosCounter(0);
    setShowSosConfirm(false);
    executeSos();
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

      {/* Predictive Safety Alert - High-Crime Zone Warning */}
      {dangerZoneAlert && (
        <Card className="border-destructive/50 bg-destructive/5 relative z-10 animate-pulse" data-testid="alert-danger-zone">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertOctagon className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">Danger Zone Alert</h3>
                <p className="text-sm text-destructive/90">
                  You're within 1km of a high-crime area with {dangerZoneAlert.crimeCount} recent incidents. 
                  Stay alert, avoid if possible, and keep your phone charged.
                </p>
                <Button
                  onClick={() => setNavigateLocation("/crime-map")}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  data-testid="button-view-danger-map"
                >
                  View Crime Map
                </Button>
              </div>
              <button
                onClick={() => setDangerZoneAlert(null)}
                className="text-destructive/50 hover:text-destructive flex-shrink-0"
                data-testid="button-dismiss-danger-alert"
              >
                ✕
              </button>
            </div>
          </CardContent>
        </Card>
      )}

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
            Tap the button twice to send an emergency alert to all your contacts or use voice commands
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pt-4">
          <button
            onClick={handleSosClick}
            disabled={contacts.length === 0}
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

          {/* Voice Command Status */}
          <div className="w-full border-t pt-4 mt-2" style={{ visibility: contacts.length > 0 ? 'visible' : 'hidden' }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Mic className={`h-4 w-4 flex-shrink-0 ${isVoiceEnabled ? 'text-chart-5' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">Voice Commands</p>
                  <p className="text-xs text-muted-foreground">Say "SOS", "emergency", "help", "danger", or "mayday"</p>
                </div>
              </div>
              <Switch
                checked={isVoiceEnabled}
                onCheckedChange={setVoiceEnabled}
                data-testid="toggle-voice-commands"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
              You will be taken to a messaging screen where you can select which contacts receive your SOS alert with your location. Message: "I am in danger save me!!"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setSosCounter(0); setSosActive(false); }} data-testid="button-cancel-sos">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmSos} className="bg-destructive hover:bg-destructive/90" data-testid="button-confirm-sos">
              Go to Messaging
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
