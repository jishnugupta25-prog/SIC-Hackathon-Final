import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Map, Hospital, Shield, Phone, Navigation, MapPin, Pill, Search, Loader2, X, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";

interface SafePlace {
  id: string;
  name: string;
  type: "hospital" | "police" | "safe_zone" | "pharmacy";
  latitude: number;
  longitude: number;
  address: string;
  phone?: string;
  distance?: number;
}

interface Suggestion {
  displayName: string;
  latitude: number;
  longitude: number;
}

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // Convert to meters
};

export default function SafePlaces() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useState<{ latitude: number; longitude: number; name: string } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ 
    latitude: number; 
    longitude: number; 
    accuracy: number; 
    placeName?: string;
    hierarchy?: string[];
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"loading" | "active" | "disabled" | "denied">("loading");
  const [selectedType, setSelectedType] = useState<"all" | "hospital" | "police" | "safe_zone" | "pharmacy">("all");
  const [searchPlace, setSearchPlace] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showLocationAlert, setShowLocationAlert] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState("");
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const reverseGeoTimer = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const placeNameCacheRef = useRef<Record<string, string>>({});

  // Helper to fetch and cache place name with complete hierarchy - defined outside useEffect so refresh button can use it
  const fetchPlaceName = async (lat: number, lon: number, skipCache: boolean = false): Promise<{ name: string; hierarchy: string[] }> => {
    try {
      // Create cache key from rounded coordinates
      const cacheKey = `${Math.round(lat * 10000)},${Math.round(lon * 10000)}`;
      
      // Check cache first (unless forced refresh)
      if (!skipCache && cacheKey in placeNameCacheRef.current) {
        const cached = placeNameCacheRef.current[cacheKey];
        console.log(`[Cache] Found ${cacheKey} -> ${cached}`);
        return { name: cached, hierarchy: [] };
      }
      
      // Fetch from API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
      
      const response = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`[Reverse Geocode] API error: ${response.status}`);
        return { name: "Unknown Location", hierarchy: [] };
      }
      
      const data = await response.json();
      const placeName = data.placeName || "Unknown Location";
      const hierarchy = data.hierarchy || [];
      
      placeNameCacheRef.current[cacheKey] = placeName;
      console.log(`[Reverse Geocode] ${lat.toFixed(4)}, ${lon.toFixed(4)} -> ${placeName}, Hierarchy: ${hierarchy.join(" → ")}`);
      return { name: placeName, hierarchy };
    } catch (error: any) {
      console.error("[Reverse Geocode] Error:", error.message || error);
      return { name: "Unknown Location", hierarchy: [] };
    }
  };

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

  // Get current location on mount and watch for updates
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("disabled");
      setLocationErrorMessage("Geolocation is not supported by your browser");
      setShowLocationAlert(true);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    // Request permission and get initial position
    const requestLocation = () => {
      setLocationStatus("loading");
      const timeout = setTimeout(() => {
        setLocationStatus("disabled");
        setLocationErrorMessage("Location request timed out. Please try again.");
        setShowLocationAlert(true);
      }, 12000);
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(timeout);
          const currentLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
          };
          console.log("[GPS] ✓ Current location acquired:", {
            lat: currentLoc.latitude.toFixed(6),
            lon: currentLoc.longitude.toFixed(6),
            accuracy: `±${currentLoc.accuracy}m`
          });
          
          lastLocationRef.current = { latitude: currentLoc.latitude, longitude: currentLoc.longitude };
          
          // Fetch place name and hierarchy from coordinates
          const { name: placeName, hierarchy } = await fetchPlaceName(currentLoc.latitude, currentLoc.longitude, false);
          currentLoc.placeName = placeName;
          currentLoc.hierarchy = hierarchy;
          
          setCurrentLocation(currentLoc);
          setLocation({
            latitude: currentLoc.latitude,
            longitude: currentLoc.longitude,
            name: placeName,
          });
          setLocationStatus("active");
        },
        (error) => {
          clearTimeout(timeout);
          console.error("[GPS] Error:", error.code, error.message);
          let errorMsg = "Unable to get your location";
          let errorStatus: "disabled" | "denied" = "disabled";

          if (error.code === 1) {
            errorMsg = "Location permission denied. Enable it in your browser settings to continue.";
            errorStatus = "denied";
          } else if (error.code === 2) {
            errorMsg = "Location unavailable. Verify GPS is enabled on your device.";
          } else if (error.code === 3) {
            errorMsg = "Location request timed out. Please enable high accuracy GPS and retry.";
          }

          setLocationErrorMessage(errorMsg);
          setLocationStatus(errorStatus);
          setShowLocationAlert(true);
        },
        options
      );
    };

    requestLocation();

    // Watch for continuous location updates with 100m distance threshold
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const currentLoc = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        };
        
        // Only update if location moved more than 100 meters (filters GPS noise)
        const distance = lastLocationRef.current ? 
          calculateDistance(
            lastLocationRef.current.latitude,
            lastLocationRef.current.longitude,
            currentLoc.latitude,
            currentLoc.longitude
          ) : 999;
        
        if (distance <= 100) {
          console.log(`[GPS] Noise filtered (${Math.round(distance)}m < 100m threshold)`);
          return;
        }
        
        console.log(`[GPS] ✓ Position updated (+${Math.round(distance)}m)`);
        lastLocationRef.current = { latitude: currentLoc.latitude, longitude: currentLoc.longitude };
        
        // Fetch place name with 500ms debounce to avoid excessive API calls
        if (reverseGeoTimer.current) {
          clearTimeout(reverseGeoTimer.current);
        }
        
        reverseGeoTimer.current = setTimeout(async () => {
          const { name: placeName, hierarchy } = await fetchPlaceName(currentLoc.latitude, currentLoc.longitude, false);
          currentLoc.placeName = placeName;
          currentLoc.hierarchy = hierarchy;
          
          setCurrentLocation(currentLoc);
          if (!location) {
            setLocation({
              latitude: currentLoc.latitude,
              longitude: currentLoc.longitude,
              name: placeName,
            });
          }
          setLocationStatus("active");
        }, 500);
      },
      (error) => {
        console.error("[GPS] Watch error:", error.code);
      },
      options
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Handle search input with debounce
  const handleSearchInput = (value: string) => {
    setSearchPlace(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/suggestions?q=${encodeURIComponent(value)}`);
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (error) {
        console.error("[Suggestions] Error:", error);
        setSuggestions([]);
      }
    }, 300);
  };

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setLocation({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      name: suggestion.displayName.split(",")[0] || suggestion.displayName,
    });
    setSearchPlace("");
    setSuggestions([]);
    setShowSuggestions(false);
    toast({ title: "Location Found", description: suggestion.displayName });
  };

  const handleSearchPlace = async () => {
    if (!searchPlace.trim()) {
      toast({ title: "Error", description: "Please enter a place name", variant: "destructive" });
      return;
    }

    setIsSearching(true);
    try {
      console.log("[Search] Looking for:", searchPlace);
      const response = await fetch(`/api/geocode?place=${encodeURIComponent(searchPlace)}`);
      const data = await response.json();

      if (!response.ok) {
        console.log("[Search] Not found:", data.message);
        toast({ title: "Not Found", description: data.message || `Could not find "${searchPlace}"`, variant: "destructive" });
        setIsSearching(false);
        return;
      }

      console.log("[Search] Found:", data);
      setLocation({
        latitude: data.latitude,
        longitude: data.longitude,
        name: searchPlace,
      });
      setSearchPlace("");
      setSuggestions([]);
      setShowSuggestions(false);
      toast({ title: "Location Found", description: `Showing safe places near ${searchPlace}` });
    } catch (error: any) {
      console.error("[Search] Error:", error);
      toast({ title: "Error", description: "Failed to search location. Please try again.", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const { data: safePlaces = [], isLoading, isError, refetch } = useQuery<SafePlace[]>({
    queryKey: ["/api/safe-places", location?.latitude, location?.longitude],
    queryFn: async () => {
      if (!location) throw new Error("Location not available");
      const response = await fetch(`/api/safe-places?latitude=${location.latitude}&longitude=${location.longitude}`);
      if (!response.ok) throw new Error("Failed to fetch safe places");
      return response.json();
    },
    enabled: isAuthenticated && !!location,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  // Auto-refetch when location changes
  useEffect(() => {
    if (location && isAuthenticated) {
      refetch();
    }
  }, [location?.latitude, location?.longitude, isAuthenticated, refetch]);

  const getPlaceIcon = (type: string) => {
    switch (type) {
      case "hospital":
        return <Hospital className="h-5 w-5 text-destructive" />;
      case "police":
        return <Shield className="h-5 w-5 text-primary" />;
      case "pharmacy":
        return <Pill className="h-5 w-5 text-chart-3" />;
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
      case "pharmacy":
        return "bg-chart-3/10 text-chart-3";
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
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

      {/* Location Status Card */}
      <Card className={`border-2 ${locationStatus === "active" ? "border-green-500/50 bg-green-50 dark:bg-green-950/20" : "border-red-500/50 bg-red-50 dark:bg-red-950/20"}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {locationStatus === "active" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 animate-pulse" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 animate-pulse" />
            )}
            {locationStatus === "loading" ? "Detecting Location..." : locationStatus === "active" ? "Location Active" : "Location Disabled"}
          </CardTitle>
          <CardDescription>
            {locationStatus === "active"
              ? "Your device location is being tracked"
              : "Enable location services on your device"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {locationStatus === "loading" && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Getting your precise location...</p>
            </div>
          )}

          {locationStatus === "active" && currentLocation && (
            <div className="space-y-3">
              {currentLocation.placeName && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 p-3 rounded-md border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground mb-1">📍 Current Location</p>
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100">{currentLocation.placeName}</p>
                  {currentLocation.hierarchy && currentLocation.hierarchy.length > 0 && (
                    <p className="text-xs text-green-700 dark:text-green-200 mt-1 truncate">
                      {currentLocation.hierarchy.join(" → ")}
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-md border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground mb-1">Latitude</p>
                  <p className="text-sm font-mono font-semibold">{currentLocation.latitude.toFixed(6)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-md border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground mb-1">Longitude</p>
                  <p className="text-sm font-mono font-semibold">{currentLocation.longitude.toFixed(6)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                  Accuracy: ±{currentLocation.accuracy}m
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={async () => {
                    setLocationStatus("loading");
                    try {
                      const { name: placeName, hierarchy } = await fetchPlaceName(currentLocation.latitude, currentLocation.longitude, true);
                      const updatedLoc = { ...currentLocation, placeName, hierarchy };
                      setCurrentLocation(updatedLoc);
                      setLocationStatus("active");
                      toast({ title: "Refreshed", description: "Location updated successfully!" });
                    } catch (error) {
                      setLocationStatus("active");
                      toast({ title: "Error", description: "Failed to refresh location", variant: "destructive" });
                    }
                  }}
                  data-testid="button-refresh-location"
                >
                  <Navigation className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          )}

          {(locationStatus === "disabled" || locationStatus === "denied") && (
            <div className="space-y-3">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-md border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">Location Services Off</p>
                    <p className="text-xs text-red-700 dark:text-red-300">{locationErrorMessage}</p>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const options = {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                  };
                  setLocationStatus("loading");
                  navigator.geolocation.getCurrentPosition(
                    async (position) => {
                      const currentLoc = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: Math.round(position.coords.accuracy),
                      };
                      
                      lastLocationRef.current = { latitude: currentLoc.latitude, longitude: currentLoc.longitude };
                      const { name: placeName, hierarchy } = await fetchPlaceName(currentLoc.latitude, currentLoc.longitude, false);
                      currentLoc.placeName = placeName;
                      currentLoc.hierarchy = hierarchy;
                      
                      setCurrentLocation(currentLoc);
                      setLocation({
                        latitude: currentLoc.latitude,
                        longitude: currentLoc.longitude,
                        name: placeName,
                      });
                      setLocationStatus("active");
                      toast({ title: "Success", description: "Location enabled and detected!" });
                    },
                    (error) => {
                      setLocationStatus("disabled");
                      toast({ title: "Error", description: "Still unable to access location. Please enable it in your device settings.", variant: "destructive" });
                    },
                    options
                  );
                }}
                className="w-full"
                data-testid="button-enable-location"
              >
                <Navigation className="h-3 w-3 mr-2" />
                Enable Location Services
              </Button>
              <p className="text-xs text-muted-foreground">
                💡 <strong>Tip:</strong> Go to your browser/device settings and enable location access for this app
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location Permission Alert Dialog */}
      <AlertDialog open={showLocationAlert} onOpenChange={setShowLocationAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              Enable Location Services
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locationErrorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Dismiss</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const options = {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0,
                };
                setLocationStatus("loading");
                navigator.geolocation.getCurrentPosition(
                  async (position) => {
                    const currentLoc = {
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                      accuracy: Math.round(position.coords.accuracy),
                    };
                    
                    lastLocationRef.current = { latitude: currentLoc.latitude, longitude: currentLoc.longitude };
                    const { name: placeName, hierarchy } = await fetchPlaceName(currentLoc.latitude, currentLoc.longitude, false);
                    currentLoc.placeName = placeName;
                    currentLoc.hierarchy = hierarchy;
                    
                    setCurrentLocation(currentLoc);
                    setLocation({
                      latitude: currentLoc.latitude,
                      longitude: currentLoc.longitude,
                      name: placeName,
                    });
                    setLocationStatus("active");
                    setShowLocationAlert(false);
                  },
                  () => {
                    setLocationStatus("disabled");
                  },
                  options
                );
              }}
            >
              Retry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Place Search Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Location
          </CardTitle>
          <CardDescription>Enter any city, landmark, or address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  placeholder="e.g., Mumbai, Central Park, or Hospital Road"
                  value={searchPlace}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearchPlace()}
                  data-testid="input-place-search"
                  className="h-9 text-sm"
                  disabled={isSearching}
                />
                {searchPlace && (
                  <button
                    onClick={() => {
                      setSearchPlace("");
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-input rounded-md shadow-lg z-50">
                    {suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground flex items-start gap-2 border-b last:border-b-0"
                      >
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{suggestion.displayName.split(",")[0]}</p>
                          <p className="text-xs text-muted-foreground truncate">{suggestion.displayName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button 
                onClick={handleSearchPlace}
                data-testid="button-search-place"
                disabled={isSearching}
                className="gap-2"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>
          </div>
          {location && (
            <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Showing results near: <strong>{location.name}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {!location ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <Navigation className="h-16 w-16 text-primary mx-auto" />
            <div>
              <h3 className="text-xl font-semibold mb-2">Find Safe Places</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Search for any city, area, or landmark above to discover nearby hospitals, police stations, pharmacies, and safe zones.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-5 gap-6">
          {/* Map Area */}
          <div className="md:col-span-3">
            <Card>
              <CardContent className="p-6">
                <div className="aspect-video bg-muted rounded-md flex items-center justify-center mb-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900" />
                  
                  {location && (
                    <div className="absolute top-4 right-4 bg-white dark:bg-slate-800 px-3 py-2 rounded-md shadow-md z-10 text-xs border border-primary/20 max-w-xs">
                      <p className="font-semibold flex items-center gap-2">
                        <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        {location.name}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1 truncate">
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </p>
                    </div>
                  )}
                  
                  <div className="relative z-0 text-center space-y-2">
                    <Map className="h-12 w-12 text-primary/60 mx-auto" />
                    <p className="text-sm text-foreground font-semibold">
                      {location ? 'Location Detected' : 'Detecting Location'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {safePlaces.length > 0 
                        ? `${safePlaces.length} safe places nearby` 
                        : 'Loading safe places...'}
                    </p>
                  </div>
                </div>
                <Tabs value={selectedType} onValueChange={(v) => setSelectedType(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                    <TabsTrigger value="hospital" data-testid="tab-hospitals">Hospitals</TabsTrigger>
                    <TabsTrigger value="police" data-testid="tab-police">Police</TabsTrigger>
                    <TabsTrigger value="pharmacy" data-testid="tab-pharmacy">Medicine</TabsTrigger>
                    <TabsTrigger value="safe_zone" data-testid="tab-safe-zones">Safe</TabsTrigger>
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
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : isError ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 text-destructive mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Failed to load safe places</p>
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
      )}

      {/* Info Cards */}
      {location && (
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Hospital className="h-5 w-5 text-destructive" />
                Hospitals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Medical facilities for emergencies
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
                Law enforcement stations
              </p>
              <p className="text-2xl font-bold mt-2">
                {safePlaces.filter(p => p.type === "police").length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Pill className="h-5 w-5 text-chart-3" />
                Pharmacies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Medicine shops
              </p>
              <p className="text-2xl font-bold mt-2">
                {safePlaces.filter(p => p.type === "pharmacy").length}
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
                Safe gathering areas
              </p>
              <p className="text-2xl font-bold mt-2">
                {safePlaces.filter(p => p.type === "safe_zone").length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
