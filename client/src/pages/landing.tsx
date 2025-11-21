import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, MapPin, AlertTriangle, Phone, Brain, Map } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-heading font-bold">Crime Report Portal</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight">
            Stay Safe, Report Crime, Get Help
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Your personal safety companion with emergency SOS alerts, real-time crime mapping,
            and AI-powered safety recommendations
          </p>
          <div className="pt-4">
            <Button asChild size="lg" data-testid="button-get-started">
              <a href="/api/login">Get Started</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="p-6 space-y-4">
            <div className="h-12 w-12 rounded-md bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Emergency SOS</h3>
            <p className="text-sm text-muted-foreground">
              Double-tap SOS button to instantly alert your emergency contacts with your location via SMS
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
              <Map className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Crime Map</h3>
            <p className="text-sm text-muted-foreground">
              View reported crimes in your area with interactive maps and real-time updates
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="h-12 w-12 rounded-md bg-chart-2/10 flex items-center justify-center">
              <Phone className="h-6 w-6 text-chart-2" />
            </div>
            <h3 className="text-lg font-semibold">Emergency Contacts</h3>
            <p className="text-sm text-muted-foreground">
              Manage trusted contacts who receive your SOS alerts when you need help
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="h-12 w-12 rounded-md bg-chart-3/10 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-chart-3" />
            </div>
            <h3 className="text-lg font-semibold">Report Crime</h3>
            <p className="text-sm text-muted-foreground">
              Easily report crimes with location details, descriptions, and optional anonymity
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="h-12 w-12 rounded-md bg-chart-4/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-chart-4" />
            </div>
            <h3 className="text-lg font-semibold">Safe Places</h3>
            <p className="text-sm text-muted-foreground">
              Find nearby hospitals, police stations, and designated safe zones on the map
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="h-12 w-12 rounded-md bg-chart-5/10 flex items-center justify-center">
              <Brain className="h-6 w-6 text-chart-5" />
            </div>
            <h3 className="text-lg font-semibold">AI Safety Insights</h3>
            <p className="text-sm text-muted-foreground">
              Get crime pattern analysis and personalized safe route recommendations powered by Gemini AI
            </p>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 Crime Report Portal. Your safety is our priority.
          </p>
        </div>
      </footer>
    </div>
  );
}
