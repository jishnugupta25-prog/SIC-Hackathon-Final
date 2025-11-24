import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import crimeMapImg from "@assets/generated_images/crime_map_visualization.png";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, MapPin, CheckCircle, Upload, Mic, Square, Play, Trash2, Image as ImageIcon, Video, Volume2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCrimeReportSchema } from "@shared/schema";
import type { z } from "zod";

type ReportFormData = z.infer<typeof insertCrimeReportSchema>;

const crimeTypes = [
  "Theft",
  "Burglary",
  "Assault",
  "Robbery",
  "Vandalism",
  "Vehicle Theft",
  "Fraud",
  "Harassment",
  "Sexual Assault",
  "Rape",
  "Murder",
  "Kidnapping",
  "Stalking",
  "Drug Trafficking",
  "Human Trafficking",
  "Arson",
  "Cybercrime",
  "Money Laundering",
  "Animal Cruelty",
  "Animal Abuse",
  "Domestic Violence",
  "Child Abuse",
  "Pickpocketing",
  "Mugging",
  "Blackmail",
  "Extortion",
  "Trespassing",
  "Drunk Driving",
  "Hit and Run",
  "Other",
];

export default function ReportCrime() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [voicePlayUrl, setVoicePlayUrl] = useState<string>("");

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

  // Get current location with fallback
  useEffect(() => {
    // Fallback location (center of India)
    const fallbackLocation = { latitude: 20.5937, longitude: 78.9629 };

    if (!navigator.geolocation) {
      console.warn("Geolocation not available, using fallback location");
      setLocation(fallbackLocation);
      setIsUsingFallback(true);
      setLocationAccuracy(null);
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

    console.log("[Crime Report GPS] Requesting location with improved accuracy...");

    // Watch for location updates
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        console.log(`[Crime Report GPS] Reading: ±${Math.round(accuracy)}m accuracy`);

        // Keep track of the best reading
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestPosition = newLocation;
          console.log(`[Crime Report GPS] ✓ Better accuracy found: ±${Math.round(accuracy)}m`);
        }

        // Accept reading if accuracy is good (< 100m)
        if (accuracy < 100) {
          console.log(`[Crime Report GPS] ✓ Excellent accuracy achieved: ±${Math.round(accuracy)}m`);
          setLocation(newLocation);
          setLocationAccuracy(accuracy);
          setIsUsingFallback(false);
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
          clearTimeout(timeoutId);
        }
      },
      (error) => {
        console.error("[Crime Report GPS] Error:", error.code, error.message);
        // Use best position found so far or fallback
        if (bestPosition) {
          console.log(`[Crime Report GPS] Using best reading found: ±${Math.round(bestAccuracy)}m`);
          setLocation(bestPosition);
          setLocationAccuracy(bestAccuracy);
          setIsUsingFallback(false);
        } else {
          console.log("[Crime Report GPS] Using fallback location");
          setLocation(fallbackLocation);
          setIsUsingFallback(true);
          setLocationAccuracy(null);
        }
      },
      options
    );

    // Timeout after 30 seconds - use best reading found
    timeoutId = setTimeout(() => {
      console.log("[Crime Report GPS] Timeout reached");
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (bestPosition) {
        console.log(`[Crime Report GPS] Using best reading found: ±${Math.round(bestAccuracy)}m`);
        setLocation(bestPosition);
        setLocationAccuracy(bestAccuracy);
        setIsUsingFallback(false);
      } else {
        console.log("[Crime Report GPS] Using fallback location");
        setLocation(fallbackLocation);
        setIsUsingFallback(true);
        setLocationAccuracy(null);
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

  const form = useForm<ReportFormData>({
    resolver: zodResolver(insertCrimeReportSchema),
    defaultValues: {
      userId: "",
      crimeType: "",
      description: "",
      latitude: 0,
      longitude: 0,
      address: "",
      phoneNumber: "",
      isAnonymous: 0,
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      const res = await apiRequest("POST", "/api/crimes", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      // Immediately invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/crimes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crimes/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/crimes"] });
      
      setReferenceNumber(data?.referenceNumber);
      setIsSuccess(true);
      toast({
        title: "Crime Reported",
        description: "Your report has been submitted successfully",
      });
      form.reset();
      
      // Set flag to force refetch when home component mounts
      sessionStorage.setItem('needsRefresh', 'true');
      
      // Redirect to dashboard after showing success
      setTimeout(() => {
        navigate("/");
      }, 2000);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setEvidenceFiles([...evidenceFiles, ...files]);
  };

  const removeEvidenceFile = (index: number) => {
    setEvidenceFiles(evidenceFiles.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/mp3" });
        setVoiceMessage(blob);
        setVoicePlayUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Microphone Error",
        description: "Unable to access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const clearVoiceMessage = () => {
    setVoiceMessage(null);
    setVoicePlayUrl("");
    if (voicePlayUrl) URL.revokeObjectURL(voicePlayUrl);
  };

  const onSubmit = (data: ReportFormData) => {
    if (!location) {
      toast({
        title: "Location Required",
        description: "Please enable location services to report a crime",
        variant: "destructive",
      });
      return;
    }

    // Convert files to base64 and create data URLs
    const filePromises = evidenceFiles.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        })
    );

    Promise.all(filePromises).then((evidenceUrls) => {
      // Convert voice message to base64
      let voiceUrl = "";
      if (voiceMessage) {
        const reader = new FileReader();
        reader.onloadend = () => {
          voiceUrl = reader.result as string;
          submitReport({
            ...data,
            latitude: location.latitude,
            longitude: location.longitude,
            evidenceUrls: evidenceUrls.length > 0 ? JSON.stringify(evidenceUrls) : undefined,
            voiceMessageUrl: voiceUrl || undefined,
          });
        };
        reader.readAsDataURL(voiceMessage);
      } else {
        submitReport({
          ...data,
          latitude: location.latitude,
          longitude: location.longitude,
          evidenceUrls: evidenceUrls.length > 0 ? JSON.stringify(evidenceUrls) : undefined,
        });
      }
    });
  };

  const submitReport = (data: ReportFormData) => {
    reportMutation.mutate(data);
  };

  // Reverse geocode coordinates to get address
  const fetchAddress = async (lat: number, lon: number) => {
    setIsLoadingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const data = await response.json();
      const address = data.address?.address || data.display_name || "Address not found";
      setSelectedAddress(address);
      form.setValue("address", address);
    } catch (error) {
      console.error("Failed to fetch address:", error);
      setSelectedAddress("Unable to fetch address");
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const useCurrentLocation = () => {
    if (location) {
      form.setValue("latitude", location.latitude);
      form.setValue("longitude", location.longitude);
      setSelectedLocation(location);
      fetchAddress(location.latitude, location.longitude);
      toast({
        title: "Location Set",
        description: `Using coordinates: ${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`,
      });
    }
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

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle className="h-16 w-16 text-chart-4 mb-4" />
            <h2 className="text-2xl font-heading font-bold mb-2">Report Submitted</h2>
            {referenceNumber && (
              <div className="mb-6">
                <p className="text-sm text-muted-foreground text-center mb-2">Your Reference Number is -</p>
                <p className="text-3xl font-heading font-bold text-center text-primary font-mono">{referenceNumber}</p>
                <p className="text-xs text-muted-foreground text-center mt-3">Save this for your records</p>
              </div>
            )}
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Thank you for reporting. Your submission helps keep the community safe.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setIsSuccess(false)} data-testid="button-report-another">
                Report Another Crime
              </Button>
              <Button variant="outline" asChild data-testid="button-view-map">
                <a href="/crime-map">View Crime Map</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl relative">
      {/* Crime map visualization background */}
      <div className="fixed bottom-0 left-0 opacity-5 pointer-events-none z-0 max-w-md">
        <img src={crimeMapImg} alt="" className="w-full h-auto" />
      </div>

      <div className="relative z-10">
        <h1 className="text-3xl font-heading font-bold tracking-tight">Report a Crime</h1>
        <p className="text-muted-foreground mt-1">
          Help keep the community safe by reporting criminal activity
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-6 relative z-10">
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Crime Details</CardTitle>
              <CardDescription>Provide information about the incident</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="crimeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Crime Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-crime-type">
                              <SelectValue placeholder="Select crime type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {crimeTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what happened (optional)"
                            className="min-h-32"
                            {...field}
                            value={field.value || ""}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormDescription>
                          Provide as much detail as you feel comfortable sharing
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Street address or landmark (optional)"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <div className="flex gap-2">
                          <div className="flex items-center bg-muted px-3 rounded-md border border-input text-sm font-medium text-muted-foreground">
                            +91
                          </div>
                          <FormControl>
                            <Input
                              placeholder="Enter 10-digit number (e.g., 9876543210)"
                              {...field}
                              value={field.value?.replace("+91", "") || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Only store digits, but allow display of the value
                                field.onChange(`+91${val}`);
                              }}
                              maxLength={10}
                              pattern="[0-9]*"
                              data-testid="input-phone-number"
                            />
                          </FormControl>
                        </div>
                        <FormDescription>
                          Indian phone number required (10 digits)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={useCurrentLocation}
                      disabled={!location || isUsingFallback}
                      data-testid="button-use-location"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      {!location ? "Location Unavailable" : isUsingFallback ? "Using Default Location" : "Use Current Location"}
                    </Button>
                    {location && (
                      <span className="text-xs text-muted-foreground">
                        {isUsingFallback ? "⚠️ GPS not available" : locationAccuracy ? `±${Math.round(locationAccuracy)}m` : "Loading..."}
                      </span>
                    )}
                  </div>

                  {selectedLocation && (
                    <div className="border border-primary/20 bg-primary/5 rounded-lg p-4 space-y-2" data-testid="location-display">
                      <p className="text-sm font-semibold text-foreground">Your Selected Location</p>
                      <div className="space-y-1">
                        {isLoadingAddress ? (
                          <p className="text-sm text-muted-foreground italic">Loading address...</p>
                        ) : (
                          <>
                            {selectedAddress && (
                              <p className="text-sm text-foreground font-medium bg-white/50 dark:bg-black/20 rounded p-2">
                                {selectedAddress}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Latitude:</span> {selectedLocation.latitude.toFixed(6)}°
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Longitude:</span> {selectedLocation.longitude.toFixed(6)}°
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Badge variant="default" className="text-xs">✓ Location Confirmed</Badge>
                      </div>
                    </div>
                  )}

                  {/* Evidence Upload Section */}
                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <FormLabel className="flex items-center gap-2 mb-2">
                        <Upload className="h-4 w-4" />
                        Evidence Files (Images/Videos)
                      </FormLabel>
                      <FormDescription className="mb-2">
                        Upload photos, videos, or other evidence related to the crime (optional)
                      </FormDescription>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="evidence-upload"
                          data-testid="input-evidence-files"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById("evidence-upload")?.click()}
                          data-testid="button-upload-evidence"
                        >
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Add Files
                        </Button>
                      </div>

                      {/* Display selected evidence files */}
                      {evidenceFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-medium text-foreground">
                            Selected Files ({evidenceFiles.length}):
                          </p>
                          {evidenceFiles.map((file, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-muted p-2 rounded-md text-sm"
                              data-testid={`item-evidence-${idx}`}
                            >
                              <div className="flex items-center gap-2">
                                {file.type.startsWith("video") ? (
                                  <Video className="h-4 w-4 text-primary" />
                                ) : (
                                  <ImageIcon className="h-4 w-4 text-primary" />
                                )}
                                <span className="truncate">{file.name}</span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEvidenceFile(idx)}
                                data-testid={`button-remove-evidence-${idx}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Voice Message Recording Section */}
                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <FormLabel className="flex items-center gap-2 mb-2">
                        <Mic className="h-4 w-4" />
                        Voice Message Explanation
                      </FormLabel>
                      <FormDescription className="mb-2">
                        Record a voice message to explain what happened (optional)
                      </FormDescription>

                      {!voiceMessage ? (
                        <Button
                          type="button"
                          variant={isRecording ? "destructive" : "outline"}
                          size="sm"
                          onClick={isRecording ? stopRecording : startRecording}
                          data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
                        >
                          {isRecording ? (
                            <>
                              <Square className="h-4 w-4 mr-2" />
                              Stop Recording
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4 mr-2" />
                              Start Recording
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 bg-muted p-3 rounded-md">
                            <Volume2 className="h-4 w-4 text-primary flex-shrink-0" />
                            <audio controls className="flex-1 h-8" data-testid="audio-player">
                              <source src={voicePlayUrl} type="audio/mp3" />
                            </audio>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={clearVoiceMessage}
                              data-testid="button-clear-voice"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">Voice message recorded ✓</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="isAnonymous"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value === 1}
                            onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                            data-testid="checkbox-anonymous"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Submit Anonymously</FormLabel>
                          <FormDescription>
                            Your identity will not be associated with this report
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={reportMutation.isPending}
                    data-testid="button-submit-report"
                  >
                    {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Important Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Emergency Situations</p>
                  <p className="text-xs text-muted-foreground">
                    If you're in immediate danger, call emergency services (911) immediately
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Location Privacy</p>
                  <p className="text-xs text-muted-foreground">
                    Your location helps create accurate crime maps but is never shared publicly
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <CheckCircle className="h-5 w-5 text-chart-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Anonymous Reports</p>
                  <p className="text-xs text-muted-foreground">
                    You can submit reports anonymously if you prefer not to share your identity
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
