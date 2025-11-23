import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map, AlertTriangle, Calendar, MapPin, Brain } from "lucide-react";
import type { CrimeReport } from "@shared/schema";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function CrimeMap() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedCrime, setSelectedCrime] = useState<CrimeReport | null>(null);

  const {
    data: crimes = [],
    isLoading,
    isError,
  } = useQuery<CrimeReport[]>({
    queryKey: ["/api/crimes"],
    enabled: isAuthenticated,
  });

  const {
    data: aiInsights,
    isLoading: aiLoading,
    isError: aiError,
  } = useQuery<{ analysis: string; recommendations: string[] }>({
    queryKey: ["/api/ai/crime-analysis"],
    enabled: isAuthenticated && crimes.length > 0,
  });

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

    console.log("[Crime Map GPS] Requesting location with improved accuracy...");

    // Watch for location updates
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        console.log(`[Crime Map GPS] Reading: ±${Math.round(accuracy)}m accuracy`);

        // Keep track of the best reading
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestPosition = newLocation;
          console.log(`[Crime Map GPS] ✓ Better accuracy found: ±${Math.round(accuracy)}m`);
        }

        // Accept reading if accuracy is good (< 100m)
        if (accuracy < 100) {
          console.log(`[Crime Map GPS] ✓ Excellent accuracy achieved: ±${Math.round(accuracy)}m`);
          setLocation(newLocation);
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
          clearTimeout(timeoutId);
        }
      },
      (error) => {
        console.error("[Crime Map GPS] Error:", error.code, error.message);
        // Use best position found so far or fallback
        if (bestPosition) {
          console.log(`[Crime Map GPS] Using best reading found: ±${Math.round(bestAccuracy)}m`);
          setLocation(bestPosition);
        } else {
          console.log("[Crime Map GPS] Using fallback location");
          setLocation(fallbackLocation);
        }
      },
      options,
    );

    // Timeout after 30 seconds - use best reading found
    timeoutId = setTimeout(() => {
      console.log("[Crime Map GPS] Timeout reached");
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (bestPosition) {
        console.log(`[Crime Map GPS] Using best reading found: ±${Math.round(bestAccuracy)}m`);
        setLocation(bestPosition);
      } else {
        console.log("[Crime Map GPS] Using fallback location");
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

  // Crime color mapping
  const crimeColors: Record<string, string> = {
    Theft: "#f97316",
    Burglary: "#d946ef",
    Assault: "#ef4444",
    Robbery: "#0ea5e9",
    Vandalism: "#eab308",
    "Vehicle Theft": "#10b981",
    Fraud: "#f59e0b",
    Harassment: "#ec4899",
    "Sexual Assault": "#dc2626",
    Rape: "#7c2d12",
    Murder: "#1e1b4b",
    Kidnapping: "#6366f1",
    Stalking: "#8b5cf6",
    "Drug Trafficking": "#14b8a6",
    "Human Trafficking": "#f43f5e",
    Arson: "#ea580c",
    Cybercrime: "#06b6d4",
    "Money Laundering": "#a16207",
    "Animal Cruelty": "#d97706",
    "Animal Abuse": "#ca8a04",
    "Domestic Violence": "#be123c",
    "Child Abuse": "#be185d",
    Pickpocketing: "#7dd3fc",
    Mugging: "#fca5a5",
    Blackmail: "#fed7aa",
    Extortion: "#fbbf24",
    Trespassing: "#86efac",
    "Drunk Driving": "#a78bfa",
    "Hit and Run": "#fda4af",
    Other: "#6b7280",
  };

  useEffect(() => {
    const container = document.getElementById("crime-map-container");
    if (!container || !location) return;

    // Clear any existing map instance
    const existingLeafletId = (container as any)._leaflet_id;
    if (existingLeafletId) {
      delete (container as any)._leaflet_id;
    }
    container.innerHTML = ""; // Clear previous map content

    // Initialize Leaflet map
    const leafletMap = L.map(container).setView(
      [location.latitude, location.longitude],
      12
    );

    // Add OpenStreetMap tile layer (real street map)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(leafletMap);

    // Add user location marker
    (L.circleMarker as any)([location.latitude, location.longitude], {
      radius: 8,
      fillColor: "#3b82f6",
      color: "#1e40af",
      weight: 3,
      opacity: 1,
      fillOpacity: 0.8,
    })
      .bindPopup("Your Location")
      .addTo(leafletMap);

    // Add circles for sensitive areas (high crime density zones)
    const crimeHotspots = new Map<string, { lat: number; lon: number; count: number }>();
    
    crimes.forEach((crime) => {
      const key = `${Math.round(crime.latitude * 100)},${Math.round(crime.longitude * 100)}`;
      if (crimeHotspots.has(key)) {
        const spot = crimeHotspots.get(key)!;
        spot.count++;
      } else {
        crimeHotspots.set(key, {
          lat: crime.latitude,
          lon: crime.longitude,
          count: 1,
        });
      }
    });

    // Draw sensitive areas as circles based on crime concentration
    crimeHotspots.forEach((hotspot: { lat: number; lon: number; count: number }) => {
      const intensity = Math.min(hotspot.count / 5, 1); // Max intensity at 5+ crimes
      const radius = 300 + intensity * 1200; // 300m to 1500m radius
      const opacity = 0.2 + intensity * 0.3; // 0.2 to 0.5 opacity

      L.circle([hotspot.lat, hotspot.lon], {
        radius: radius,
        color: "#ef4444",
        weight: 2,
        opacity: opacity,
        fillColor: "#ef4444",
        fillOpacity: opacity * 0.5,
      })
        .bindPopup(
          `<strong>Sensitive Area</strong><br/>Crime incidents: ${hotspot.count}`
        )
        .addTo(leafletMap);
    });

    // Add crime report markers
    crimes.forEach((crime, idx) => {
      const markerColor = crimeColors[crime.crimeType] || "#6b7280";
      
      const customIcon = L.divIcon({
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background-color: ${markerColor};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          ">${idx + 1}</div>
        `,
        iconSize: [32, 32],
        className: "crime-marker-icon",
      });

      const marker = L.marker([crime.latitude, crime.longitude], {
        icon: customIcon,
      });

      const popupContent = `
        <div style="font-size: 12px;">
          <strong>${crime.crimeType}</strong><br/>
          ${crime.address ? `Location: ${crime.address}<br/>` : ''}
          ${crime.description ? `Details: ${crime.description.substring(0, 50)}...<br/>` : ''}
          Reported: ${new Date(crime.reportedAt || '').toLocaleDateString()}
        </div>
      `;

      marker.bindPopup(popupContent).addTo(leafletMap);
    });

    // Fit map bounds to show all markers
    if (crimes.length > 0) {
      const group = new (L.FeatureGroup as any)([]);
      crimes.forEach((crime) => {
        group.addLayer(
          L.marker([crime.latitude, crime.longitude])
        );
      });
      group.addLayer(L.marker([location.latitude, location.longitude]));
      leafletMap.fitBounds(group.getBounds().pad(0.1));
    }

    // Cleanup on unmount
    return () => {
      leafletMap.remove();
    };
  }, [location, crimes]);

  const getCrimeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Theft: "bg-chart-3",
      Burglary: "bg-chart-5",
      Assault: "bg-destructive",
      Robbery: "bg-chart-1",
      Vandalism: "bg-chart-2",
      "Vehicle Theft": "bg-chart-4",
      Fraud: "bg-chart-3",
      Harassment: "bg-destructive",
      Other: "bg-muted",
    };
    return colors[type] || "bg-muted";
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
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
    return (R * c).toFixed(1);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading crime data...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to Load Crime Data
            </h3>
            <p className="text-sm text-muted-foreground">
              Unable to fetch crime reports. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">
          Crime Map
        </h1>
        <p className="text-muted-foreground mt-1">
          View reported crimes in your area
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Map & Crime List */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-6">
              <div
                id="crime-map-container"
                className="bg-muted rounded-md mb-4"
                style={{ height: "400px" }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    {location
                      ? `Your Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                      : "Location unavailable"}
                  </span>
                </div>
                <Badge variant="outline">{crimes.length} Reports</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Crime Reports</CardTitle>
              <CardDescription>
                Criminal activity reported in your area
              </CardDescription>
            </CardHeader>
            <CardContent>
              {crimes.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No crime reports in your area
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {crimes.slice(0, 10).map((crime) => (
                    <div
                      key={crime.id}
                      className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                      onClick={() => setSelectedCrime(crime)}
                      data-testid={`crime-item-${crime.id}`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full mt-2 ${getCrimeTypeColor(crime.crimeType)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{crime.crimeType}</p>
                          <Badge variant="secondary" className="text-xs">
                            {location
                              ? `${calculateDistance(location.latitude, location.longitude, crime.latitude, crime.longitude)} km away`
                              : "Distance unknown"}
                          </Badge>
                        </div>
                        {crime.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                            {crime.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(crime.reportedAt)}
                          </span>
                          {crime.address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {crime.address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Insights & Stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-chart-5" />
                AI Safety Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiLoading ? (
                <div className="text-center py-4">
                  <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Analyzing crime patterns...
                  </p>
                </div>
              ) : aiError ? (
                <p className="text-sm text-muted-foreground">
                  Unable to generate AI insights at this time
                </p>
              ) : aiInsights ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Pattern Analysis</p>
                    <p className="text-xs text-muted-foreground">
                      {aiInsights.analysis}
                    </p>
                  </div>
                  {aiInsights.recommendations &&
                    aiInsights.recommendations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Recommendations
                        </p>
                        <ul className="space-y-1">
                          {aiInsights.recommendations.map((rec, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-muted-foreground flex items-start gap-2"
                            >
                              <span className="text-primary mt-0.5">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  AI insights will appear when crime data is available
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Crime Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {["Theft", "Burglary", "Assault", "Robbery", "Vandalism"].map(
                  (type) => {
                    const count = crimes.filter(
                      (c) => c.crimeType === type,
                    ).length;
                    const percentage =
                      crimes.length > 0 ? (count / crimes.length) * 100 : 0;
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{type}</span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getCrimeTypeColor(type)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="button-report-crime"
              >
                <a href="/report-crime">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Report a Crime
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="button-safe-places"
              >
                <a href="/safe-places">
                  <MapPin className="h-4 w-4 mr-2" />
                  Find Safe Places
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
