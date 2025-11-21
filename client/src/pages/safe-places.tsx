import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, Hospital, Shield, Phone, Navigation, MapPin } from "lucide-react";

interface SafePlace {
  id: string;
  name: string;
  type: "hospital" | "police" | "safe_zone";
  latitude: number;
  longitude: number;
  address: string;
  phone?: string;
  distance?: number;
}

export default function SafePlaces() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedType, setSelectedType] = useState<"all" | "hospital" | "police" | "safe_zone">("all");

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

  const { data: safePlaces = [], isLoading, isError } = useQuery<SafePlace[]>({
    queryKey: location 
      ? ["/api/safe-places", { latitude: location.latitude, longitude: location.longitude }]
      : ["/api/safe-places"],
    enabled: isAuthenticated && !!location,
  });

  const getPlaceIcon = (type: string) => {
    switch (type) {
      case "hospital":
        return <Hospital className="h-5 w-5 text-destructive" />;
      case "police":
        return <Shield className="h-5 w-5 text-primary" />;
      case "safe_zone":
        return <MapPin className="h-5 w-5 text-chart-4" />;
      default:
        return <MapPin className="h-5 w-5" />;
    }
  };

  const getPlaceColor = (type: string) => {
    switch (type) {
      case "hospital":
        return "bg-destructive/10 text-destructive";
      case "police":
        return "bg-primary/10 text-primary";
      case "safe_zone":
        return "bg-chart-4/10 text-chart-4";
      default:
        return "bg-muted";
    }
  };

  const filteredPlaces = selectedType === "all" 
    ? safePlaces 
    : safePlaces.filter(p => p.type === selectedType);

  const openInMaps = (lat: number, lng: number, name: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`;
    window.open(url, "_blank");
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Finding safe places...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Failed to Load Safe Places</h3>
            <p className="text-sm text-muted-foreground">
              Unable to fetch safe places. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Safe Places</h1>
        <p className="text-muted-foreground mt-1">
          Find nearby hospitals, police stations, and safe zones
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Map Area */}
        <div className="md:col-span-3">
          <Card>
            <CardContent className="p-6">
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center mb-4">
                <div className="text-center space-y-2">
                  <Map className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Safe places map will be displayed here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Google Maps integration with safe place markers
                  </p>
                </div>
              </div>
              <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                  <TabsTrigger value="hospital" data-testid="tab-hospitals">Hospitals</TabsTrigger>
                  <TabsTrigger value="police" data-testid="tab-police">Police</TabsTrigger>
                  <TabsTrigger value="safe_zone" data-testid="tab-safe-zones">Safe Zones</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Safe Places List */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Nearby Locations</CardTitle>
              <CardDescription>
                {filteredPlaces.length} place{filteredPlaces.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!location ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Enable location to find nearby safe places</p>
                </div>
              ) : filteredPlaces.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No safe places found nearby</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredPlaces.map((place) => (
                    <div
                      key={place.id}
                      className="p-4 rounded-md border space-y-3"
                      data-testid={`place-${place.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0 ${getPlaceColor(place.type)}`}>
                          {getPlaceIcon(place.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm">{place.name}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {place.address}
                          </p>
                          {place.distance !== undefined && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {place.distance.toFixed(1)} km away
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => openInMaps(place.latitude, place.longitude, place.name)}
                          data-testid={`button-directions-${place.id}`}
                        >
                          <Navigation className="h-3 w-3 mr-2" />
                          Directions
                        </Button>
                        {place.phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            data-testid={`button-call-${place.id}`}
                          >
                            <a href={`tel:${place.phone}`}>
                              <Phone className="h-3 w-3 mr-2" />
                              Call
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Hospital className="h-5 w-5 text-destructive" />
              Hospitals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Medical facilities for emergencies and urgent care
            </p>
            <p className="text-2xl font-bold mt-2">
              {safePlaces.filter(p => p.type === "hospital").length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Police Stations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Law enforcement stations for reporting crimes
            </p>
            <p className="text-2xl font-bold mt-2">
              {safePlaces.filter(p => p.type === "police").length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-chart-4" />
              Safe Zones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Community-designated safe gathering areas
            </p>
            <p className="text-2xl font-bold mt-2">
              {safePlaces.filter(p => p.type === "safe_zone").length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
