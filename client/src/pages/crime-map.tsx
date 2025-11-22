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

    // Create a simple map background with Google Maps Static API as fallback
    const mapImage = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${location.longitude},${location.latitude},12,0/600x400@2x?access_token=pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbHZ6In0.example`;
    
    // Create simple HTML-based map display
    const html = `
      <div style="position: relative; width: 100%; height: 100%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
        <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #e8f4f8 0%, #d4e6eb 100%);"></div>
        <div style="position: absolute; width: 20px; height: 20px; background: #3b82f6; border: 3px solid #1e40af; border-radius: 50%; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 10; box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.2);"></div>
        ${crimes.map((crime, idx) => {
          const offsetLat = (crime.latitude - location.latitude) * 1000;
          const offsetLon = (crime.longitude - location.longitude) * 1000;
          const x = 50 + (offsetLon / 1000) * 30;
          const y = 50 - (offsetLat / 1000) * 30;
          return `<div style="position: absolute; width: 12px; height: 12px; background: #ef4444; border: 2px solid #dc2626; border-radius: 50%; left: ${Math.max(5, Math.min(95, x))}%; top: ${Math.max(5, Math.min(95, y))}%; transform: translate(-50%, -50%); cursor: pointer; z-index: 5; transition: all 0.2s;" onmouseover="this.style.transform='translate(-50%, -50%) scale(1.3)'; this.style.zIndex='20';" onmouseout="this.style.transform='translate(-50%, -50%) scale(1)'; this.style.zIndex='5';" title="${crime.crimeType} - ${formatDate(crime.reportedAt)}"></div>`;
        }).join('')}
        <div style="position: absolute; bottom: 8px; right: 8px; background: white; padding: 6px 10px; border-radius: 4px; font-size: 11px; color: #666; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">© OpenStreetMap</div>
      </div>
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
