import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertTriangle, MapPin, CheckCircle } from "lucide-react";
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
  "Other",
];

export default function ReportCrime() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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

  // Get current location with improved accuracy and logging
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

    console.log("Requesting report crime location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        console.log("Report crime location obtained:", newLocation);
        setLocation(newLocation);
      },
      (error) => {
        console.error("Geolocation error for crime reporting:", error.code, error.message);
      },
      options
    );
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
      isAnonymous: false,
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      return await apiRequest("POST", "/api/crimes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crimes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crimes/recent"] });
      setIsSuccess(true);
      toast({
        title: "Crime Reported",
        description: "Your report has been submitted successfully",
      });
      form.reset();
      setTimeout(() => {
        setIsSuccess(false);
      }, 5000);
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

  const onSubmit = (data: ReportFormData) => {
    if (!location) {
      toast({
        title: "Location Required",
        description: "Please enable location services to report a crime",
        variant: "destructive",
      });
      return;
    }

    reportMutation.mutate({
      ...data,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  };

  const useCurrentLocation = () => {
    if (location) {
      form.setValue("latitude", location.latitude);
      form.setValue("longitude", location.longitude);
      toast({
        title: "Location Set",
        description: "Using your current location",
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
            <p className="text-muted-foreground text-center mb-6">
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Report a Crime</h1>
        <p className="text-muted-foreground mt-1">
          Help keep the community safe by reporting criminal activity
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
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

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={useCurrentLocation}
                      disabled={!location}
                      data-testid="button-use-location"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      {location ? "Use Current Location" : "Location Unavailable"}
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="isAnonymous"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
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
