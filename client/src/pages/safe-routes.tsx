import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Route, Shield, Navigation, Zap, Locate, Search, X } from "lucide-react";
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

interface LocationSuggestion {
  name: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

export default function SafeRoutes() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [startCoords, setStartCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [endLocation, setEndLocation] = useState("");
  const [endCoords, setEndCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routes, setRoutes] = useState<SafeRoute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<SafeRoute | null>(null);
  const [startSuggestions, setStartSuggestions] = useState<LocationSuggestion[]>([]);
  const [endSuggestions, setEndSuggestions] = useState<LocationSuggestion[]>([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const endSuggestionsRef = useRef<HTMLDivElement>(null);

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

  // Initial geolocation on page load
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

  // Search locations using Nominatim (OpenStreetMap)
  const searchLocations = async (query: string): Promise<LocationSuggestion[]> => {
    if (!query || query.length < 2) return [];

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
      );
      const data = await response.json();
      
      return data.map((item: any) => ({
        name: item.name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        displayName: item.display_name,
      }));
    } catch (error) {
      console.error("Error searching locations:", error);
      return [];
    }
  };

  // Handle start location search
  const handleStartLocationSearch = async (query: string) => {
    setStartLocation(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setStartSuggestions([]);
      setShowStartSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const suggestions = await searchLocations(query);
      setStartSuggestions(suggestions);
      setShowStartSuggestions(suggestions.length > 0);
    }, 300);
  };

  // Handle end location search
  const handleEndLocationSearch = async (query: string) => {
    setEndLocation(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setEndSuggestions([]);
      setShowEndSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const suggestions = await searchLocations(query);
      setEndSuggestions(suggestions);
      setShowEndSuggestions(suggestions.length > 0);
    }, 300);
  };

  // Select start location from suggestions
  const selectStartLocation = (suggestion: LocationSuggestion) => {
    setStartLocation(suggestion.displayName);
    setStartCoords({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setStartSuggestions([]);
    setShowStartSuggestions(false);
  };

  // Select end location from suggestions
  const selectEndLocation = (suggestion: LocationSuggestion) => {
    setEndLocation(suggestion.displayName);
    setEndCoords({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setEndSuggestions([]);
    setShowEndSuggestions(false);
  };

  // Detect current location and set as start location
  const handleDetectCurrentLocation = () => {
    if (isDetectingLocation) return;

    setIsDetectingLocation(true);

    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not available on your device",
        variant: "destructive",
      });
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setStartCoords({ latitude, longitude });
        setLocation({ latitude, longitude });

        // Reverse geocode to get location name
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          setStartLocation(data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setLocationName(data.address?.city || data.address?.town || "Current Location");
        } catch (error) {
          console.error("Error reverse geocoding:", error);
          setStartLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setLocationName("Current Location");
        }

        toast({
          title: "Success",
          description: "Current location detected. Now search for your destination.",
        });
        setIsDetectingLocation(false);
      },
      (error) => {
        console.error("Error detecting location:", error);
        toast({
          title: "Error",
          description: "Could not detect your current location. Please enable location services.",
          variant: "destructive",
        });
        setIsDetectingLocation(false);
      }
    );
  };

  const handleSuggestRoutes = async () => {
    if (!startCoords || !endCoords) {
      toast({
        title: "Error",
        description: "Please select both start and end locations",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log("Sending route suggestion request:", {
        startLocation,
        endLocation,
        startCoords,
        endCoords,
      });

      const response = await fetch("/api/suggest-safer-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLocation,
          endLocation,
          userLocation: startCoords,
          startCoords,
          endCoords,
        }),
      });

      console.log("Response status:", response.status);
      const responseText = await response.text();
      console.log("Response text:", responseText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log("Parsed data:", data);
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
              <CardDescription>Search and select your start and end locations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Start Location Section */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Start Location</label>
                <div className="relative z-40">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Search start location..."
                        value={startLocation}
                        onChange={(e) => handleStartLocationSearch(e.target.value)}
                        onFocus={() => startSuggestions.length > 0 && setShowStartSuggestions(true)}
                        data-testid="input-start-location"
                        className="pr-8"
                      />
                      {startLocation && (
                        <button
                          onClick={() => {
                            setStartLocation("");
                            setStartCoords(null);
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-clear-start"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Start Location Suggestions Dropdown */}
                  {showStartSuggestions && startSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                      {startSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectStartLocation(suggestion)}
                          className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                          data-testid={`suggestion-start-${idx}`}
                        >
                          <p className="text-sm font-medium">{suggestion.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{suggestion.displayName}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Detect Current Location Button */}
                <Button
                  onClick={handleDetectCurrentLocation}
                  disabled={isDetectingLocation}
                  variant="outline"
                  className="w-full"
                  data-testid="button-detect-location"
                >
                  {isDetectingLocation ? (
                    <>
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Detecting Location...
                    </>
                  ) : (
                    <>
                      <Locate className="h-4 w-4 mr-2" />
                      Use Current Location
                    </>
                  )}
                </Button>

                {locationName && (
                  <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded">
                    ✓ Detected: {locationName}
                  </p>
                )}
              </div>

              {/* End Location Section */}
              <div className="space-y-2 border-t pt-4">
                <label className="text-sm font-medium">End Location</label>
                <div className="relative z-30">
                  <Input
                    placeholder="Search destination..."
                    value={endLocation}
                    onChange={(e) => handleEndLocationSearch(e.target.value)}
                    onFocus={() => endSuggestions.length > 0 && setShowEndSuggestions(true)}
                    data-testid="input-end-location"
                    className="pr-8"
                  />
                  {endLocation && (
                    <button
                      onClick={() => {
                        setEndLocation("");
                        setEndCoords(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-end"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}

                  {/* End Location Suggestions Dropdown */}
                  {showEndSuggestions && endSuggestions.length > 0 && (
                    <div 
                      ref={endSuggestionsRef}
                      className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
                    >
                      {endSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectEndLocation(suggestion)}
                          className="w-full text-left px-4 py-2 hover:bg-muted transition-colors border-b last:border-b-0"
                          data-testid={`suggestion-end-${idx}`}
                        >
                          <p className="text-sm font-medium">{suggestion.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{suggestion.displayName}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Suggest Routes Button */}
              <Button
                onClick={handleSuggestRoutes}
                disabled={isLoading || !startCoords || !endCoords}
                className="w-full mt-4"
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
