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
    if (!navigator.geolocation) {
      console.warn("Geolocation not available");
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    console.log("Requesting crime map location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        console.log("Crime map location obtained:", newLocation);
        setLocation(newLocation);
      },
      (error) => {
        console.error(
          "Geolocation error for crime map:",
          error.code,
          error.message,
        );
      },
      options,
    );
  }, []);

  useEffect(() => {
    const container = document.getElementById("crime-map-container");
    if (!container || !location) return;

    // Calculate positions with collision avoidance
    const crimeColors: Record<string, string> = {
      Theft: "#f97316",
      Burglary: "#d946ef",
      Assault: "#ef4444",
      Robbery: "#0ea5e9",
      Vandalism: "#eab308",
      "Vehicle Theft": "#10b981",
      Fraud: "#f97316",
      Harassment: "#ef4444",
      Other: "#6b7280",
    };

    const positions: Array<{ x: number; y: number; crime: CrimeReport; idx: number }> = [];

    crimes.forEach((crime, idx) => {
      const offsetLat = (crime.latitude - location.latitude) * 1000;
      const offsetLon = (crime.longitude - location.longitude) * 1000;
      let x = 50 + (offsetLon / 1000) * 25;
      let y = 50 - (offsetLat / 1000) * 25;

      // Collision avoidance: spread out nearby crimes
      let collisionFound = true;
      let attempt = 0;
      while (collisionFound && attempt < 8) {
        collisionFound = false;
        for (let j = 0; j < positions.length; j++) {
          const otherPos = positions[j];
          const dist = Math.sqrt(
            Math.pow(x - otherPos.x, 2) + Math.pow(y - otherPos.y, 2),
          );
          if (dist < 8) {
            collisionFound = true;
            const angle = Math.atan2(y - otherPos.y, x - otherPos.x);
            x += Math.cos(angle) * 3;
            y += Math.sin(angle) * 3;
            break;
          }
        }
        attempt++;
      }

      positions.push({ x: Math.max(8, Math.min(92, x)), y: Math.max(8, Math.min(92, y)), crime, idx });
    });

    const color = (type: string) => crimeColors[type] || "#6b7280";

    const legendItems = [
      { type: "Theft", color: crimeColors.Theft },
      { type: "Burglary", color: crimeColors.Burglary },
      { type: "Assault", color: crimeColors.Assault },
      { type: "Robbery", color: crimeColors.Robbery },
      { type: "Vandalism", color: crimeColors.Vandalism },
      { type: "Vehicle Theft", color: crimeColors["Vehicle Theft"] },
      { type: "Other", color: crimeColors.Other },
    ];

    const html = `
      <div style="position: relative; width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #e8f4f8 0%, #d4e6eb 100%);"></div>
        <div style="position: absolute; width: 24px; height: 24px; background: #3b82f6; border: 4px solid #1e40af; border-radius: 50%; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 10; box-shadow: 0 0 0 10px rgba(59, 130, 246, 0.15);"></div>
        ${positions.map((pos) => {
          const bgColor = color(pos.crime.crimeType);
          return `
            <div style="position: absolute; left: ${pos.x}%; top: ${pos.y}%; z-index: 5; transform: translate(-50%, -50%);">
              <div style="position: relative; width: 28px; height: 28px; cursor: pointer; transition: all 0.3s ease;">
                <div style="position: absolute; width: 28px; height: 28px; background: ${bgColor}; border: 3px solid ${bgColor}; border-radius: 50%; box-shadow: 0 0 0 3px white, 0 2px 8px rgba(0,0,0,0.2); transition: all 0.3s;" onmouseover="this.style.transform='scale(1.4)'; this.style.zIndex='20'; this.style.boxShadow='0 0 0 3px white, 0 4px 12px rgba(0,0,0,0.3)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 0 0 3px white, 0 2px 8px rgba(0,0,0,0.2)';"></div>
                <div style="position: absolute; width: 24px; height: 24px; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: white; z-index: 6; pointer-events: none;">${pos.idx + 1}</div>
                <div style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: white; padding: 4px 8px; border-radius: 4px; white-space: nowrap; font-size: 11px; font-weight: 500; pointer-events: none; opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">${pos.crime.crimeType}</div>
              </div>
            </div>
          `;
        }).join('')}
        <button id="legend-toggle" style="position: absolute; top: 12px; left: 12px; background: white; border: 1px solid #ddd; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; color: #333; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 15; transition: all 0.2s;">▼ Legend</button>
        <div id="legend-content" style="position: absolute; top: 48px; left: 12px; background: white; padding: 10px 12px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 15; max-height: 350px; overflow-y: auto; display: none; width: 180px;">
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #333;">Crime Types</div>
          ${legendItems.map((item) => `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; color: #555;">
              <div style="width: 16px; height: 16px; background-color: ${item.color}; border: 2px solid ${item.color}; border-radius: 50%; flex-shrink: 0;"></div>
              <span>${item.type}</span>
            </div>
          `).join('')}
        </div>
        <div style="position: absolute; bottom: 8px; right: 8px; background: white; padding: 6px 10px; border-radius: 4px; font-size: 11px; color: #666; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">© OpenStreetMap</div>
      </div>
      <script>
        const toggleBtn = document.getElementById('legend-toggle');
        const legendContent = document.getElementById('legend-content');
        if (toggleBtn && legendContent) {
          toggleBtn.addEventListener('click', function() {
            const isHidden = legendContent.style.display === 'none';
            legendContent.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? '▲ Legend' : '▼ Legend';
          });
        }
      </script>
    `;
    
    container.innerHTML = html;
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
