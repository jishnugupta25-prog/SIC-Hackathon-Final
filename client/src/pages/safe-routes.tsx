import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Route, Shield, Navigation, Zap } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface SafeRoute {
  id: string;
  name: string;
  distance: number;
  duration: number;
  safetyScore: number;
  crimeCount: number;
  coordinates: [number, number][];
  color: string;
  recommendation: string;
}

export default function SafeRoutes() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const [routes, setRoutes] = useState<SafeRoute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<SafeRoute | null>(null);

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

  useEffect(() => {
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

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    console.log("[Safe Routes GPS] Requesting location...");

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestPosition = newLocation;
        }

        if (accuracy < 100) {
          setLocation(newLocation);
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
          clearTimeout(timeoutId);
        }
      },
      (error) => {
        console.error("[Safe Routes GPS] Error:", error.code, error.message);
        if (bestPosition) {
          setLocation(bestPosition);
        } else {
          setLocation(fallbackLocation);
        }
      },
      options,
    );

    timeoutId = setTimeout(() => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (bestPosition) {
        setLocation(bestPosition);
      } else {
        setLocation(fallbackLocation);
      }
    }, 30000);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearTimeout(timeoutId);
    };
  }, []);

  const handleSuggestRoutes = async () => {
    if (!startLocation || !endLocation) {
      toast({
        title: "Error",
        description: "Please enter both start and end locations",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/suggest-safer-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLocation,
          endLocation,
          userLocation: location,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch routes");
      }

      const data = await response.json();
      setRoutes(data.routes || []);
      
      if (data.routes.length === 0) {
        toast({
          title: "Info",
          description: "No alternative routes found for this journey",
        });
      } else {
        toast({
          title: "Success",
          description: `Found ${data.routes.length} safer route options`,
        });
      }
    } catch (error: any) {
      console.error("Error fetching routes:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch safer routes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedRoute) return;

    try {
      const container = document.getElementById("route-map");
      if (!container || !location) return;

      const existingLeafletId = (container as any)._leaflet_id;
      if (existingLeafletId) {
        delete (container as any)._leaflet_id;
      }
      container.innerHTML = "";

      const map = L.map(container).setView([location.latitude, location.longitude], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // Draw route
      const latlngs = selectedRoute.coordinates.map((coord) => [coord[0], coord[1]]);
      L.polyline(latlngs, {
        color: selectedRoute.color,
        weight: 4,
        opacity: 0.8,
        dashArray: selectedRoute.crimeCount > 0 ? "5, 5" : undefined,
      }).addTo(map);

      // Start marker
      L.circleMarker([latlngs[0][0], latlngs[0][1]], {
        radius: 8,
        fillColor: "#22c55e",
        color: "#16a34a",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup("Start")
        .addTo(map);

      // End marker
      L.circleMarker([latlngs[latlngs.length - 1][0], latlngs[latlngs.length - 1][1]], {
        radius: 8,
        fillColor: "#ef4444",
        color: "#dc2626",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup("End")
        .addTo(map);

      // Fit bounds
      const group = new (L.FeatureGroup as any)([]);
      latlngs.forEach((coord: any) => {
        group.addLayer(L.marker(coord));
      });
      map.fitBounds(group.getBounds().pad(0.1));

      return () => {
        try {
          map.remove();
        } catch (e) {
          console.error("Error cleaning up map:", e);
        }
      };
    } catch (error) {
      console.error("Error initializing route map:", error);
    }
  }, [selectedRoute, location]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Safe Route Planner</h1>
        <p className="text-muted-foreground mt-1">Get safer route suggestions that avoid high-crime areas</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Route Input */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Plan Your Route
              </CardTitle>
              <CardDescription>Enter your starting and ending locations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Location</label>
                <Input
                  placeholder="e.g., Park Street, Kolkata"
                  value={startLocation}
                  onChange={(e) => setStartLocation(e.target.value)}
                  data-testid="input-start-location"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">End Location</label>
                <Input
                  placeholder="e.g., Howrah Station, Kolkata"
                  value={endLocation}
                  onChange={(e) => setEndLocation(e.target.value)}
                  data-testid="input-end-location"
                />
              </div>

              <Button
                onClick={handleSuggestRoutes}
                disabled={isLoading}
                className="w-full"
                data-testid="button-suggest-routes"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Finding Safe Routes...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Suggest Safer Routes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Routes List */}
          {routes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Available Routes</CardTitle>
                <CardDescription>Select a route to view details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {routes.map((route) => (
                  <div
                    key={route.id}
                    onClick={() => setSelectedRoute(route)}
                    className="p-4 border rounded-lg cursor-pointer hover-elevate transition-all"
                    style={{
                      borderLeftColor: route.color,
                      borderLeftWidth: "4px",
                      backgroundColor:
                        selectedRoute?.id === route.id ? "rgba(59, 130, 246, 0.1)" : undefined,
                    }}
                    data-testid={`route-option-${route.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{route.name}</h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {route.distance.toFixed(1)} km
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {route.duration} mins
                          </Badge>
                          <Badge
                            variant={route.safetyScore > 0.7 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            Safety: {(route.safetyScore * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{route.recommendation}</p>
                      </div>
                      {route.crimeCount > 0 && (
                        <div className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-xs font-semibold">{route.crimeCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map & Info */}
        <div className="space-y-4">
          {selectedRoute && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Route Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="font-semibold">{selectedRoute.distance.toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Time</p>
                    <p className="font-semibold">{selectedRoute.duration} minutes</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Safety Score</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${selectedRoute.safetyScore > 0.7 ? "bg-green-500" : selectedRoute.safetyScore > 0.4 ? "bg-yellow-500" : "bg-red-500"}`}
                          style={{ width: `${selectedRoute.safetyScore * 100}%` }}
                        />
                      </div>
                      <span className="font-semibold text-sm">{(selectedRoute.safetyScore * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Crime Reports Nearby</p>
                    <p className="font-semibold text-sm">{selectedRoute.crimeCount} incidents</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {selectedRoute && (
            <Card>
              <CardContent className="pt-6">
                <div
                  id="route-map"
                  className="bg-muted rounded-md"
                  style={{ height: "300px" }}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Safety Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>✓ Choose routes with higher safety scores</p>
              <p>✓ Avoid traveling alone late at night</p>
              <p>✓ Share your route with emergency contacts</p>
              <p>✓ Keep your phone charged and location on</p>
              <p>✓ Trust your instincts about your surroundings</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
