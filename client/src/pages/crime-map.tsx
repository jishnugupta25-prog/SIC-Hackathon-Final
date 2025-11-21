import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map, AlertTriangle, Calendar, MapPin, Brain } from "lucide-react";
import type { CrimeReport } from "@shared/schema";

export default function CrimeMap() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedCrime, setSelectedCrime] = useState<CrimeReport | null>(null);

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

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  const { data: crimes = [], isLoading } = useQuery<CrimeReport[]>({
    queryKey: ["/api/crimes"],
    enabled: isAuthenticated,
  });

  const { data: aiInsights, isLoading: aiLoading } = useQuery<{ analysis: string; recommendations: string[] }>({
    queryKey: ["/api/ai/crime-analysis"],
    enabled: isAuthenticated && crimes.length > 0,
  });

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
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Crime Map</h1>
        <p className="text-muted-foreground mt-1">
          View reported crimes in your area
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Map Placeholder & Crime List */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center mb-4">
                <div className="text-center space-y-2">
                  <Map className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Interactive crime map will be displayed here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Google Maps integration with crime markers
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    {location ? `Your Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "Location unavailable"}
                  </span>
                </div>
                <Badge variant="outline">{crimes.length} Reports</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Crime Reports</CardTitle>
              <CardDescription>Criminal activity reported in your area</CardDescription>
            </CardHeader>
            <CardContent>
              {crimes.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No crime reports in your area</p>
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
                      <div className={`h-2 w-2 rounded-full mt-2 ${getCrimeTypeColor(crime.crimeType)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{crime.crimeType}</p>
                          <Badge variant="secondary" className="text-xs">
                            {location ? `${calculateDistance(location.latitude, location.longitude, crime.latitude, crime.longitude)} km away` : "Distance unknown"}
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
                  <p className="text-xs text-muted-foreground mt-2">Analyzing crime patterns...</p>
                </div>
              ) : aiInsights ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-1">Pattern Analysis</p>
                    <p className="text-xs text-muted-foreground">{aiInsights.analysis}</p>
                  </div>
                  {aiInsights.recommendations && aiInsights.recommendations.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Recommendations</p>
                      <ul className="space-y-1">
                        {aiInsights.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
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
                {["Theft", "Burglary", "Assault", "Robbery", "Vandalism"].map((type) => {
                  const count = crimes.filter((c) => c.crimeType === type).length;
                  const percentage = crimes.length > 0 ? (count / crimes.length) * 100 : 0;
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
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full" data-testid="button-report-crime">
                <a href="/report-crime">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Report a Crime
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full" data-testid="button-safe-places">
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
