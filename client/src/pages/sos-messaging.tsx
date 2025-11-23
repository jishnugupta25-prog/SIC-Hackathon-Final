import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Send, MapPin, Phone, User, CheckCircle2 } from "lucide-react";
import type { EmergencyContact } from "@shared/schema";

export default function SosMessaging() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You need to be logged in",
        variant: "destructive",
      });
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation, toast]);

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

  // SOS Alert mutation
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
        description: `Emergency message sent to ${selectedContacts.size || contacts.length} contact${(selectedContacts.size || contacts.length) !== 1 ? 's' : ''}`,
      });
      setSendingTo(null);
      setTimeout(() => {
        setLocation("/");
      }, 1500);
      queryClient.invalidateQueries({ queryKey: ["/api/sos-history"] });
    },
    onError: (error: Error) => {
      toast({
        title: "SOS Failed",
        description: error.message || "Failed to send SOS alert",
        variant: "destructive",
      });
      setSendingTo(null);
    },
  });

  // Toggle contact selection
  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)));
    }
  };

  const handleSendSOS = () => {
    if (selectedContacts.size === 0 && contacts.length === 0) {
      toast({
        title: "No Contacts",
        description: "No emergency contacts selected",
        variant: "destructive",
      });
      return;
    }
    setSendingTo("sending");
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

  const contactsToSendTo = selectedContacts.size > 0 ? selectedContacts.size : contacts.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Emergency Alert Header */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Emergency SOS Alert
          </CardTitle>
          <CardDescription>
            Your location and emergency message will be sent to selected contacts via SMS
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Location Information */}
      {userLocation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Your Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Latitude:</span> {userLocation.latitude.toFixed(6)}</p>
              <p><span className="font-medium">Longitude:</span> {userLocation.longitude.toFixed(6)}</p>
              {userLocation.address && (
                <p><span className="font-medium">Location:</span> {userLocation.address}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emergency Message</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md border">
            <p className="font-medium text-sm">Message to be sent:</p>
            <p className="mt-2 text-sm">
              <strong>"I am in danger save me!!"</strong>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              📍 Location: {userLocation?.latitude.toFixed(6)}, {userLocation?.longitude.toFixed(6)}
            </p>
            <p className="text-xs text-muted-foreground">
              👤 User: {user?.firstName} ({user?.email})
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contacts Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Emergency Contacts</CardTitle>
          <CardDescription>
            Choose which contacts should receive your SOS alert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No emergency contacts added yet</p>
              <Button asChild variant="outline" className="mt-4">
                <a href="/contacts">Add Emergency Contacts</a>
              </Button>
            </div>
          ) : (
            <>
              {/* Select All Option */}
              <div className="flex items-center gap-3 p-3 border rounded-md hover-elevate cursor-pointer">
                <Checkbox
                  id="select-all"
                  checked={selectedContacts.size === contacts.length && contacts.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all-contacts"
                />
                <label htmlFor="select-all" className="flex-1 cursor-pointer">
                  <p className="font-medium text-sm">Send to all {contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground">Select all emergency contacts at once</p>
                </label>
              </div>

              {/* Individual Contacts */}
              <div className="space-y-2 border-t pt-4">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 border rounded-md hover-elevate cursor-pointer"
                  >
                    <Checkbox
                      id={`contact-${contact.id}`}
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                      data-testid={`checkbox-contact-${contact.id}`}
                    />
                    <label htmlFor={`contact-${contact.id}`} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm">{contact.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {contact.phoneNumber}
                          </p>
                          {contact.relationship && (
                            <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                          )}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Send Button */}
      {contacts.length > 0 && (
        <Card className="border-green-200 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-md p-4">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  ✓ Ready to send to {contactsToSendTo} contact{contactsToSendTo !== 1 ? 's' : ''}
                </p>
              </div>
              <Button
                onClick={handleSendSOS}
                disabled={sosMutation.isPending || contactsToSendTo === 0}
                className="w-full bg-destructive hover:bg-destructive/90 h-12"
                data-testid="button-send-sos"
              >
                <Send className="h-5 w-5 mr-2" />
                {sosMutation.isPending ? "Sending SOS..." : "Send SOS Alert Now"}
              </Button>
              <Button
                onClick={() => setLocation("/")}
                variant="outline"
                className="w-full"
                data-testid="button-cancel-sos-messaging"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
