// Crime Report Portal - API Routes
// From javascript_log_in_with_replit blueprint

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { sendSosMessage } from "./twilio";
import { analyzeCrimePatterns } from "./gemini";
import { insertEmergencyContactSchema, insertCrimeReportSchema, insertSosAlertSchema } from "@shared/schema";
import * as bcrypt from "bcryptjs";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Email/Password Auth Routes
  app.post('/api/signup', async (req: any, res) => {
    try {
      const { email, firstName, lastName, password } = req.body;

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.upsertUser({
        id: undefined as any,
        email,
        firstName,
        lastName,
        passwordHash,
      });

      // Create session
      req.user = {
        claims: { sub: user.id },
        access_token: 'email-auth',
        refresh_token: 'email-auth',
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      };

      req.login(req.user, (err: any) => {
        if (err) return res.status(500).json({ message: 'Session creation failed' });
        res.json({ success: true, user });
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(500).json({ message: error.message || "Signup failed" });
    }
  });

  app.post('/api/email-login', async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create session
      req.user = {
        claims: { sub: user.id },
        access_token: 'email-auth',
        refresh_token: 'email-auth',
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      };

      req.login(req.user, (err: any) => {
        if (err) return res.status(500).json({ message: 'Session creation failed' });
        res.json({ success: true, user });
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  app.get('/api/auth/logout', (req: any, res) => {
    req.logout((err: any) => {
      if (err) return res.status(500).json({ message: 'Logout failed' });
      res.json({ success: true });
    });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Emergency Contacts routes
  app.get('/api/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contacts = await storage.getEmergencyContacts(userId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post('/api/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const contactData = insertEmergencyContactSchema.parse({
        ...req.body,
        userId,
      });
      const contact = await storage.createEmergencyContact(contactData);

      // Send confirmation SMS to the emergency contact (India-friendly)
      try {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || "User";
        
        const confirmationMsg = `Hello! ${userName} has added your number as an emergency contact in the Crime Report Portal. You will receive alerts if they trigger the SOS button. If this wasn't you, please contact them.`;
        
        const client = await (await import('./twilio')).getTwilioClient();
        const { formatPhoneNumber } = await import('./twilio');
        const formattedPhone = (await import('./twilio')).formatPhoneNumber || ((p: string) => p);
        
        // Try to send but don't fail the contact creation if SMS fails
        try {
          const twilioFrom = await (await import('./twilio')).getTwilioFromPhoneNumber();
          const formattedTo = (require('./twilio') as any).formatPhoneNumber?.(contact.phoneNumber) || 
            (contact.phoneNumber.startsWith('+') ? contact.phoneNumber : '+91' + contact.phoneNumber.replace(/^0/, ''));
          
          if (formattedTo !== twilioFrom) {
            await client.messages.create({
              body: confirmationMsg,
              from: twilioFrom,
              to: formattedTo,
            });
            console.log(`✓ Confirmation SMS sent to ${contact.phoneNumber}`);
          }
        } catch (smsError) {
          console.warn(`SMS confirmation failed (non-critical): ${smsError}`);
          // Don't fail the contact creation if SMS fails
        }
      } catch (smsError) {
        console.warn(`Could not send confirmation SMS: ${smsError}`);
        // Continue anyway - contact creation is still successful
      }

      res.json(contact);
    } catch (error: any) {
      console.error("Error creating contact:", error);
      res.status(400).json({ message: error.message || "Failed to create contact" });
    }
  });

  app.delete('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contactId = req.params.id;
      await storage.deleteEmergencyContact(contactId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Crime Reports routes
  app.get('/api/crimes', isAuthenticated, async (req: any, res) => {
    try {
      const crimes = await storage.getCrimeReports();
      res.json(crimes);
    } catch (error) {
      console.error("Error fetching crimes:", error);
      res.status(500).json({ message: "Failed to fetch crimes" });
    }
  });

  app.get('/api/crimes/recent', isAuthenticated, async (req: any, res) => {
    try {
      const crimes = await storage.getRecentCrimeReports(20);
      res.json(crimes);
    } catch (error) {
      console.error("Error fetching recent crimes:", error);
      res.status(500).json({ message: "Failed to fetch recent crimes" });
    }
  });

  app.post('/api/crimes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const crimeData = insertCrimeReportSchema.parse({
        ...req.body,
        userId,
      });
      const crime = await storage.createCrimeReport(crimeData);
      res.json(crime);
    } catch (error: any) {
      console.error("Error creating crime report:", error);
      res.status(400).json({ message: error.message || "Failed to create crime report" });
    }
  });

  // SOS Alert routes
  app.post('/api/sos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { latitude, longitude, address } = req.body;
      
      // Get user's emergency contacts
      const contacts = await storage.getEmergencyContacts(userId);
      
      if (contacts.length === 0) {
        return res.status(400).json({ message: "No emergency contacts found" });
      }

      // Send SMS to all contacts
      const userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.email || "Unknown";

      const sentTo: string[] = [];
      for (const contact of contacts) {
        try {
          await sendSosMessage(contact.phoneNumber, userName, { latitude, longitude });
          sentTo.push(contact.phoneNumber);
        } catch (error) {
          console.error(`Failed to send to ${contact.phoneNumber}:`, error);
        }
      }

      // Save SOS alert to database
      const alertData = insertSosAlertSchema.parse({
        userId,
        latitude,
        longitude,
        address: address || null,
        sentTo,
      });
      const alert = await storage.createSosAlert(alertData);

      res.json({ 
        success: true, 
        alert,
        sentCount: sentTo.length,
      });
    } catch (error: any) {
      console.error("Error sending SOS:", error);
      res.status(500).json({ message: error.message || "Failed to send SOS alert" });
    }
  });

  app.get('/api/sos-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const alerts = await storage.getUserSosAlerts(userId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching SOS history:", error);
      res.status(500).json({ message: "Failed to fetch SOS history" });
    }
  });

  // AI Crime Analysis route
  app.get('/api/ai/crime-analysis', isAuthenticated, async (req: any, res) => {
    try {
      const crimes = await storage.getCrimeReports();
      const analysis = await analyzeCrimePatterns(crimes);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing crimes:", error);
      res.status(500).json({ message: "Failed to analyze crimes" });
    }
  });

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Get location suggestions as user types (worldwide search)
  app.get('/api/suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      // Search worldwide - no viewbox restriction
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CrimeReportPortal/1.0'
        }
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return res.json([]);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data)) {
        return res.json([]);
      }

      const suggestions = data.map((item: any) => ({
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      }));

      console.log(`[Suggestions] Found ${suggestions.length} results for "${query}"`);
      res.json(suggestions);
    } catch (error: any) {
      console.error("[Suggestions] Error:", error.message);
      res.json([]);
    }
  });

  // Reverse geocode - get place name from coordinates
  app.get('/api/reverse-geocode', isAuthenticated, async (req: any, res) => {
    try {
      const lat = req.query.lat as string;
      const lon = req.query.lon as string;

      if (!lat || !lon) {
        return res.status(400).json({ message: "Latitude and longitude required" });
      }

      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CrimeReportPortal/1.0'
        }
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return res.json({ placeName: "Unknown Location" });
      }

      const data = await response.json();
      
      if (!data) {
        return res.json({ placeName: "Unknown Location" });
      }

      const address = data.address || {};
      const displayName = data.display_name || "";
      
      // Strategy: Prefer address components over display_name for accuracy
      // Address components are more structured and reliable
      let placeName = "";
      
      // Get candidate from address components - prioritize small/specific areas
      const addressCandidate = 
        address.suburb ||           // Most specific: suburb/locality
        address.town ||             // Town level
        address.hamlet ||           // Hamlet/small area
        address.village ||          // Village
        address.district ||         // District level
        address.city ||             // City (fallback)
        address.county ||           // County
        address.state;              // State
      
      // If we have a good address component, use it
      if (addressCandidate && 
          addressCandidate !== address.city && 
          addressCandidate !== address.state &&
          addressCandidate.length > 2) {
        placeName = addressCandidate;
        console.log(`[Reverse Geocode] ${lat}, ${lon} -> ${placeName} (from address components)`);
      } else if (address.city && address.city !== address.state) {
        // Use city as secondary option
        placeName = address.city;
        console.log(`[Reverse Geocode] ${lat}, ${lon} -> ${placeName} (from city)`);
      } else {
        // Last resort: parse display_name carefully
        const displayParts = displayName.split(",").map((p: string) => p.trim());
        // Look for meaningful parts in display_name (not too short, not generic)
        const meaningfulPart = displayParts.find((part: string) => 
          part.length > 3 && 
          !["India", "Country", address.state, address.city].includes(part)
        ) || displayParts[0];
        
        placeName = meaningfulPart || address.country || "Unknown Location";
        console.log(`[Reverse Geocode] ${lat}, ${lon} -> ${placeName} (fallback from display_name)`);
      }
      
      // Build complete address hierarchy for display
      const hierarchy = {
        suburb: address.suburb,
        town: address.town,
        hamlet: address.hamlet,
        village: address.village,
        district: address.district,
        city: address.city,
        county: address.county,
        state: address.state,
        country: address.country
      };
      
      // Filter out empty values and create hierarchy array
      const hierarchyArray = Object.entries(hierarchy)
        .filter(([_, value]) => value && value.length > 0)
        .map(([_, value]) => value);
      
      res.json({
        placeName: placeName,
        displayName: data.display_name,
        address: data.address,
        hierarchy: hierarchyArray,
        fullHierarchy: hierarchy
      });
    } catch (error: any) {
      console.error("[Reverse Geocode] Error:", error.message);
      res.json({ placeName: "Unknown Location" });
    }
  });

  // Geocode place name to coordinates
  app.get('/api/geocode', isAuthenticated, async (req: any, res) => {
    try {
      const placeName = req.query.place as string;
      if (!placeName || placeName.trim().length === 0) {
        return res.status(400).json({ message: "Place name required" });
      }

      console.log(`[Geocode] Searching for: ${placeName}`);

      // Use OpenStreetMap Nominatim API with proper headers
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CrimeReportPortal/1.0'
        }
      });

      const contentType = response.headers.get('content-type');
      let data;

      if (!contentType || !contentType.includes('application/json')) {
        console.error(`[Geocode] Invalid content type: ${contentType}`);
        const text = await response.text();
        console.error(`[Geocode] Response body: ${text.substring(0, 200)}`);
        return res.status(500).json({ message: "Geocoding service error" });
      }

      data = await response.json();

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log(`[Geocode] No results found for: ${placeName}`);
        return res.status(404).json({ message: `No location found for "${placeName}". Try a larger city or region.` });
      }

      const location = data[0];
      console.log(`[Geocode] Found: ${location.display_name}`);
      res.json({
        latitude: parseFloat(location.lat),
        longitude: parseFloat(location.lon),
        displayName: location.display_name
      });
    } catch (error: any) {
      console.error("[Geocode] Error:", error.message);
      res.status(500).json({ message: "Unable to search location. Please try again." });
    }
  });

  // Safe Places route - calculates distances based on user location
  app.get('/api/safe-places', isAuthenticated, async (req: any, res) => {
    try {
      const userLat = parseFloat(req.query.latitude as string);
      const userLon = parseFloat(req.query.longitude as string);
      
      // Validate coordinates
      if (isNaN(userLat) || isNaN(userLon)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }
      
      console.log(`[Safe Places] User location: ${userLat}, ${userLon}`);
      
      // Mock safe places with dynamic locations around user
      const places = [
        { name: "City General Hospital", type: "hospital", latOffset: 0.008, lonOffset: 0.012, address: "123 Medical Center Dr", phone: "+1-555-0101" },
        { name: "Central Police Station", type: "police", latOffset: -0.009, lonOffset: -0.007, address: "456 Safety Ave", phone: "911" },
        { name: "24/7 Emergency Pharmacy", type: "pharmacy", latOffset: 0.004, lonOffset: -0.006, address: "789 Wellness Plaza", phone: "+1-555-0102" },
        { name: "Community Safe Zone", type: "safe_zone", latOffset: 0.002, lonOffset: 0.003, address: "321 Community Center", phone: "" },
        { name: "Memorial Hospital", type: "hospital", latOffset: -0.012, lonOffset: 0.018, address: "654 Healthcare Blvd", phone: "+1-555-0103" },
        { name: "North District Police", type: "police", latOffset: 0.015, lonOffset: -0.011, address: "987 Law Enforcement St", phone: "911" },
        { name: "MediCare Drugstore", type: "pharmacy", latOffset: -0.006, lonOffset: 0.008, address: "555 Health Plaza Dr", phone: "+1-555-0104" },
        { name: "Central Health Clinic", type: "hospital", latOffset: 0.011, lonOffset: -0.004, address: "100 Medical Way", phone: "+1-555-0105" },
        { name: "24-Hour Medical Pharmacy", type: "pharmacy", latOffset: 0.007, lonOffset: 0.014, address: "222 Rx Street", phone: "+1-555-0106" },
        { name: "South Station Police", type: "police", latOffset: -0.014, lonOffset: 0.011, address: "333 Protection Ave", phone: "911" },
      ];

      // Calculate distances for each place
      const safePlaces = places.map((place, idx) => {
        const placeLat = userLat + place.latOffset;
        const placeLon = userLon + place.lonOffset;
        const distance = calculateDistance(userLat, userLon, placeLat, placeLon);
        return {
          id: String(idx + 1),
          name: place.name,
          type: place.type,
          latitude: placeLat,
          longitude: placeLon,
          address: place.address,
          phone: place.phone,
          distance: Math.round(distance * 100) / 100, // Round to 2 decimals
        };
      });

      // Sort by distance (closest first)
      safePlaces.sort((a, b) => a.distance - b.distance);
      
      console.log(`[Safe Places] Found ${safePlaces.length} places. Closest: ${safePlaces[0].name} (${safePlaces[0].distance}km)`);

      res.json(safePlaces);
    } catch (error) {
      console.error("Error fetching safe places:", error);
      res.status(500).json({ message: "Failed to fetch safe places" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
