import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Send, MapPin, Phone, User, ArrowLeft } from "lucide-react";
import type { EmergencyContact } from "@shared/schema";

export default function SosMessaging() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setNavigateLocation] = useLocation();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You need to be logged in",
        variant: "destructive",
      });
      setNavigateLocation("/login");
    }
  }, [isAuthenticated, setNavigateLocation, toast]);

  // Fetch emergency contacts
  const { data: contacts = [] } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/contacts"],
    enabled: isAuthenticated,
  });

  // Get location with fallback
  useEffect(() => {
    const fallbackLocation = { latitude: 20.5937, longitude: 78.9629, address: "India" };

    if (!navigator.geolocation) {
      setUserLocation(fallbackLocation);
      return;
    }

    let watchId: number | null = null;
    let bestAccuracy = Infinity;
    let bestPosition: { latitude: number; longitude: number } | null = null;

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    console.log("[SOS Messaging] Getting location...");

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        
        const accuracy = position.coords.accuracy;
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestPosition = newLocation;
        }

        if (accuracy < 100) {
          setUserLocation(newLocation);
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
        }
      },
      () => {
        if (bestPosition) {
          setUserLocation(bestPosition);
        } else {
          setUserLocation(fallbackLocation);
        }
      },
      options
    );

    setTimeout(() => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (bestPosition) {
        setUserLocation(bestPosition);
      } else {
        setUserLocation(fallbackLocation);
      }
    }, 10000);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // SOS Alert mutation - sends to all contacts
  const sosMutation = useMutation({
    mutationFn: async () => {
      if (!userLocation) {
        throw new Error("Location not available");
      }
      return await apiRequest("POST", "/api/sos", {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
    },
    onSuccess: () => {
      toast({
        title: "SOS Alert Sent!",
        description: `Emergency message sent to ${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`,
      });
      setTimeout(() => {
        setNavigateLocation("/");
      }, 1500);
      queryClient.invalidateQueries({ queryKey: ["/api/sos-history"] });
    },
    onError: (error: Error) => {
      toast({
        title: "SOS Failed",
        description: error.message || "Failed to send SOS alert",
        variant: "destructive",
      });
    },
  });

  const handleSendSOS = () => {
    if (contacts.length === 0) {
      toast({
        title: "No Contacts",
        description: "No emergency contacts added",
        variant: "destructive",
      });
      return;
    }
    sosMutation.mutate();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  const messageContent = `I am in danger save me!!

📍 Location: ${userLocation ? `${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}` : 'Getting location...'}
👤 From: ${user?.firstName || user?.email}`;

  return (
    <div className="max-w-2xl mx-auto space-y-4 h-[calc(100vh-120px)] flex flex-col">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 pb-2 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setNavigateLocation("/")}
          data-testid="button-back-to-home"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Emergency Alert
          </h2>
          <p className="text-xs text-muted-foreground">
            Sending to {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Recipients */}
      {contacts.length > 0 && (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recipients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 p-2 bg-muted/30 rounded-md"
              >
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{contact.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    {contact.phoneNumber}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Location Card */}
      {userLocation && (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Your Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-1 bg-muted/30 p-2 rounded-md">
              <p><span className="font-medium">Latitude:</span> {userLocation.latitude.toFixed(6)}</p>
              <p><span className="font-medium">Longitude:</span> {userLocation.longitude.toFixed(6)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message Box */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex-1 border rounded-md p-4 bg-muted/20 overflow-y-auto">
          <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed font-mono">
            {messageContent}
          </p>
        </div>
      </div>

      {/* Send Button */}
      {contacts.length > 0 ? (
        <div className="flex gap-3 pt-2 border-t">
          <Button
            onClick={() => setNavigateLocation("/")}
            variant="outline"
            className="flex-1"
            data-testid="button-cancel-sos-messaging"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendSOS}
            disabled={sosMutation.isPending}
            className="flex-1 bg-destructive hover:bg-destructive/90 h-10"
            data-testid="button-send-sos"
          >
            {sosMutation.isPending ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to All
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="border-t pt-4 space-y-3">
          <div className="text-center py-6 text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No emergency contacts added</p>
            <p className="text-xs mt-1">Add contacts to send SOS alerts</p>
          </div>
          <Button asChild variant="outline" className="w-full" data-testid="button-add-contacts">
            <a href="/contacts">Add Emergency Contacts</a>
          </Button>
          <Button
            onClick={() => setNavigateLocation("/")}
            variant="outline"
            className="w-full"
            data-testid="button-cancel-sos-messaging"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
