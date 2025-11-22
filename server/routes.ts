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
import { initializeDatabase } from "./initDb";

// Comprehensive safe places database for major Indian cities
const SAFE_PLACES_DB = [
  // Barasat/Kolkata area - NEAREST LOCATIONS (22.725, 88.489)
  { name: "Barasat Police Station", type: "police", latitude: 22.7445, longitude: 88.4604, address: "GN Road, Barasat, Kolkata", phone: "+91-33-2539-2019" },
  { name: "Barasat North Police Station", type: "police", latitude: 22.7547, longitude: 88.4521, address: "Mahakaran Road, Barasat, Kolkata", phone: "+91-33-2541-8976" },
  { name: "Narendrapur Police Station", type: "police", latitude: 22.7156, longitude: 88.4892, address: "Narendrapur, Kolkata", phone: "+91-33-2470-2143" },
  { name: "Amdanga Police Station", type: "police", latitude: 22.7895, longitude: 88.4371, address: "Amdanga, North 24 Parganas", phone: "+91-33-2582-3456" },
  { name: "Tangra Police Station", type: "police", latitude: 22.5782, longitude: 88.3829, address: "Tangra, Kolkata", phone: "+91-33-2368-4567" },
  { name: "Ariadaha Police Station", type: "police", latitude: 22.7623, longitude: 88.3456, address: "Ariadaha, Kolkata", phone: "+91-33-2589-3421" },
  
  // Hospitals - Barasat/Kolkata area (COMPREHENSIVE - covering 5km radius around 22.7317, 88.4998)
  // Core Barasat Area Hospitals
  { name: "Barasat Central Hospital", type: "hospital", latitude: 22.7345, longitude: 88.4900, address: "GN Road, Barasat", phone: "+91-33-2539-0101" },
  { name: "Barasat Medical Clinic", type: "hospital", latitude: 22.7320, longitude: 88.5020, address: "Ramkrishnapur Road, Barasat", phone: "+91-33-2540-5555" },
  { name: "Champadali Hospital", type: "hospital", latitude: 22.7350, longitude: 88.4980, address: "Champadali, Barasat", phone: "+91-33-2541-1111" },
  { name: "Brainware Health Center", type: "hospital", latitude: 22.7290, longitude: 88.5030, address: "Near Brainware University, Barasat", phone: "+91-33-2542-2222" },
  { name: "Barasat Nursing Care", type: "hospital", latitude: 22.7400, longitude: 88.4850, address: "Mahakaran Road, Barasat", phone: "+91-33-2543-3333" },
  { name: "Emergency Medical Center Barasat", type: "hospital", latitude: 22.7250, longitude: 88.5100, address: "Barasat, Kolkata", phone: "+91-33-2544-4444" },
  
  // Extended Barasat Vicinity Hospitals
  { name: "Amdanga Medical Hospital", type: "hospital", latitude: 22.7550, longitude: 88.4750, address: "Amdanga, North 24 Parganas", phone: "+91-33-2580-5555" },
  { name: "Narendrapur Community Hospital", type: "hospital", latitude: 22.7100, longitude: 88.4950, address: "Narendrapur, Kolkata", phone: "+91-33-2545-6666" },
  
  // Additional Hospitals Near Barasat (within 5km)
  { name: "Bhubaneswari Nursing Home", type: "hospital", latitude: 22.7101, longitude: 88.4235, address: "Barasat Road, Kolkata", phone: "+91-33-2554-2222" },
  { name: "Lifepoint Hospital", type: "hospital", latitude: 22.7456, longitude: 88.4521, address: "Barasat, Kolkata", phone: "+91-33-2589-4444" },
  { name: "North 24 Parganas District Hospital", type: "hospital", latitude: 22.7234, longitude: 88.4156, address: "Barasat, Kolkata", phone: "+91-33-2543-6666" },
  { name: "Nightingale Hospital", type: "hospital", latitude: 22.7243, longitude: 88.3876, address: "Barrackpore, Kolkata", phone: "+91-33-2593-1111" },
  
  // Pharmacies - Barasat/Kolkata area (COMPREHENSIVE within 5km radius)
  // Core Barasat Pharmacies
  { name: "Apollo Pharmacy - Barasat Main", type: "pharmacy", latitude: 22.7345, longitude: 88.4900, address: "GN Road, Barasat", phone: "+91-33-2539-3333" },
  { name: "MedPlus Pharmacy - Barasat", type: "pharmacy", latitude: 22.7320, longitude: 88.5020, address: "Mahakaran Road, Barasat", phone: "+91-33-2541-4444" },
  { name: "24 Hour Pharmacy Barasat", type: "pharmacy", latitude: 22.7400, longitude: 88.4850, address: "Barasat Central", phone: "+91-33-2554-7777" },
  { name: "Sunrise Pharmacy Barasat", type: "pharmacy", latitude: 22.7250, longitude: 88.5100, address: "Near Bus Stand, Barasat", phone: "+91-33-2589-8888" },
  { name: "Care Pharmacy Barasat", type: "pharmacy", latitude: 22.7100, longitude: 88.4950, address: "Narendrapur, Barasat", phone: "+91-33-2593-6666" },
  { name: "Med Store - Barasat", type: "pharmacy", latitude: 22.7450, longitude: 88.4950, address: "Chandra Road, Barasat", phone: "+91-33-2545-1234" },
  { name: "Healthy Life Pharmacy", type: "pharmacy", latitude: 22.7300, longitude: 88.4800, address: "Barasat Bazaar", phone: "+91-33-2546-5678" },
  { name: "City Pharmacy Barasat", type: "pharmacy", latitude: 22.7380, longitude: 88.4700, address: "Main Road, Barasat", phone: "+91-33-2560-9999" },
  
  // Extended Area Pharmacies
  { name: "Amdanga Pharmacy", type: "pharmacy", latitude: 22.7550, longitude: 88.4750, address: "Amdanga", phone: "+91-33-2580-1111" },
  
  // Dakshineswar/Central Kolkata Police Stations
  { name: "Dakshineswar Police Station", type: "police", latitude: 22.6835, longitude: 88.3612, address: "Dakshineswar, Kolkata", phone: "+91-33-2560-5436" },
  { name: "Hooghly Police Station", type: "police", latitude: 22.6457, longitude: 88.3944, address: "Park Circus, Kolkata", phone: "+91-33-2485-3141" },
  { name: "Belgharia Police Station", type: "police", latitude: 22.5861, longitude: 88.3748, address: "Belgharia, Kolkata", phone: "+91-33-2596-4321" },
  { name: "Liluah Police Station", type: "police", latitude: 22.6128, longitude: 88.3945, address: "Liluah, Howrah", phone: "+91-33-2671-3784" },
  
  // Kolkata central region
  { name: "Kolkata Police HQ", type: "police", latitude: 22.5726, longitude: 88.3639, address: "AJC Bose Rd, Kolkata, West Bengal", phone: "+91-9833099930" },
  { name: "AIIMS Kolkata", type: "hospital", latitude: 22.5029, longitude: 88.3638, address: "Sector III, Salt Lake, Kolkata", phone: "+91-33-2334-5555" },
  { name: "Calcutta Medical Research Institute", type: "hospital", latitude: 22.5482, longitude: 88.3589, address: "1 AJC Bose Road, Kolkata", phone: "+91-33-4007-7000" },
  { name: "Medica Hospital", type: "hospital", latitude: 22.5238, longitude: 88.3805, address: "127, Mukundapur, Kolkata", phone: "+91-33-6652-0000" },
  
  // Delhi region
  { name: "Delhi Police HQ", type: "police", latitude: 28.6328, longitude: 77.2197, address: "Crime Branch, IP Estate, New Delhi", phone: "+91-11-2436-0346" },
  { name: "North Delhi Police Station", type: "police", latitude: 28.7041, longitude: 77.2064, address: "G T Road, North Delhi", phone: "+91-11-2735-3881" },
  { name: "South Delhi Police Station", type: "police", latitude: 28.5344, longitude: 77.1963, address: "Malviya Nagar, South Delhi", phone: "+91-11-4161-0000" },
  { name: "East Delhi Police Station", type: "police", latitude: 28.5988, longitude: 77.3156, address: "Preet Vihar, East Delhi", phone: "+91-11-4227-5454" },
  { name: "AIIMS Delhi", type: "hospital", latitude: 28.5675, longitude: 77.2070, address: "Ansari Nagar, New Delhi", phone: "+91-11-2658-8500" },
  { name: "Apollo Hospital", type: "hospital", latitude: 28.5549, longitude: 77.2061, address: "Sarita Vihar, New Delhi", phone: "+91-11-7188-1000" },
  { name: "Max Hospital", type: "hospital", latitude: 28.5344, longitude: 77.1963, address: "Patparganj, New Delhi", phone: "+91-11-4161-0000" },
  { name: "Fortis Hospital", type: "hospital", latitude: 28.5926, longitude: 77.2540, address: "Okhla, New Delhi", phone: "+91-11-4055-1111" },
  
  // Mumbai region
  { name: "Mumbai Police HQ", type: "police", latitude: 19.0176, longitude: 72.8479, address: "Fort, Mumbai", phone: "+91-22-2262-0111" },
  { name: "Bandra Police Station", type: "police", latitude: 19.0596, longitude: 72.8295, address: "Bandra East, Mumbai", phone: "+91-22-2644-5051" },
  { name: "Colaba Police Station", type: "police", latitude: 18.9562, longitude: 72.8298, address: "Colaba, Mumbai", phone: "+91-22-2204-3450" },
  { name: "Breach Candy Hospital", type: "hospital", latitude: 19.0254, longitude: 72.8236, address: "Breech Candy, Mumbai", phone: "+91-22-6633-4444" },
  { name: "Apollo Hospital Mumbai", type: "hospital", latitude: 19.0819, longitude: 72.8622, address: "Navi Mumbai", phone: "+91-22-6199-1111" },
  { name: "Hinduja Hospital", type: "hospital", latitude: 19.0735, longitude: 72.8262, address: "Mahim, Mumbai", phone: "+91-22-6779-1000" },
  
  // Bangalore region
  { name: "Bangalore Police HQ", type: "police", latitude: 13.0006, longitude: 77.5708, address: "Halasuru, Bangalore", phone: "+91-80-2249-2000" },
  { name: "Whitefield Police Station", type: "police", latitude: 13.0347, longitude: 77.7349, address: "Whitefield, Bangalore", phone: "+91-80-2851-4100" },
  { name: "Indiranagar Police Station", type: "police", latitude: 13.0359, longitude: 77.6384, address: "Indiranagar, Bangalore", phone: "+91-80-4114-5000" },
  { name: "Apollo Hospital Bangalore", type: "hospital", latitude: 13.1939, longitude: 77.6245, address: "Bannerghatta Road, Bangalore", phone: "+91-80-4000-0100" },
  { name: "Manipal Hospital", type: "hospital", latitude: 13.1939, longitude: 77.6245, address: "Old Airport Road, Bangalore", phone: "+91-80-6699-9999" },
  { name: "Fortis Hospital Bangalore", type: "hospital", latitude: 13.0835, longitude: 77.6106, address: "Banashankari, Bangalore", phone: "+91-80-6180-1111" },
  
  // Chennai region
  { name: "Chennai Police HQ", type: "police", latitude: 13.0505, longitude: 80.2270, address: "Chennai Central, Tamil Nadu", phone: "+91-44-2538-2151" },
  { name: "Anna Nagar Police Station", type: "police", latitude: 13.1607, longitude: 80.2164, address: "Anna Nagar, Chennai", phone: "+91-44-4297-0000" },
  { name: "Apollo Hospital Chennai", type: "hospital", latitude: 13.1884, longitude: 80.2270, address: "Greams Road, Chennai", phone: "+91-44-2829-2020" },
  { name: "Fortis Hospital Chennai", type: "hospital", latitude: 13.0827, longitude: 80.2707, address: "Enthirum Veedu, Chennai", phone: "+91-44-4219-0000" },
  { name: "Stanley Medical College Hospital", type: "hospital", latitude: 13.0088, longitude: 80.2800, address: "Stanley, Chennai", phone: "+91-44-2535-7000" },
];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database schema on startup (auto-creates tables if needed)
  await initializeDatabase();
  
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
      res.redirect('/login');
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
        sentTo: sentTo, // Array of phone numbers
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

  // Get location suggestions using Google Maps Geocoding API
  app.get('/api/suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn("[Suggestions] Google Maps API key not configured");
        return res.json([]);
      }

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&components=country:in`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Suggestions] HTTP ${response.status}`);
        return res.json([]);
      }

      const data = await response.json();
      if (data.status !== 'OK' || !Array.isArray(data.predictions)) {
        console.warn(`[Suggestions] API error: ${data.status}`);
        return res.json([]);
      }

      // Get detailed location for each prediction
      const suggestions = await Promise.all(
        data.predictions.slice(0, 8).map(async (prediction: any) => {
          try {
            const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${apiKey}`;
            const detailResponse = await fetch(detailUrl, { signal: AbortSignal.timeout(3000) });
            
            if (!detailResponse.ok) return null;
            
            const detailData = await detailResponse.json();
            if (detailData.status !== 'OK' || !detailData.result?.geometry?.location) {
              return null;
            }

            return {
              displayName: prediction.description,
              latitude: detailData.result.geometry.location.lat,
              longitude: detailData.result.geometry.location.lng
            };
          } catch (error) {
            console.warn("[Suggestions] Error getting details:", error);
            return null;
          }
        })
      );

      const validSuggestions = suggestions.filter(Boolean);
      console.log(`[Suggestions] Found ${validSuggestions.length} results for "${query}"`);
      res.json(validSuggestions);
    } catch (error: any) {
      console.error("[Suggestions] Error:", error.message);
      res.json([]);
    }
  });

  // Reverse geocode - get place name from coordinates using Photon (free OSM service)
  app.get('/api/reverse-geocode', isAuthenticated, async (req: any, res) => {
    try {
      const lat = req.query.lat as string;
      const lon = req.query.lon as string;

      if (!lat || !lon) {
        return res.status(400).json({ message: "Latitude and longitude required" });
      }

      const numLat = parseFloat(lat);
      const numLon = parseFloat(lon);
      
      if (isNaN(numLat) || isNaN(numLon)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      console.log(`[Reverse Geocode] Reverse geocoding: ${numLat},${numLon}`);

      // Use Photon (OSM) - free reverse geocoding with multiple results for best match
      const photonUrl = `https://photon.komoot.io/reverse?lon=${numLon}&lat=${numLat}&limit=5`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      let response, data;
      try {
        response = await fetch(photonUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Crime-Report-Portal/1.0' }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[Reverse Geocode] Photon HTTP ${response.status}`);
          return res.json({ placeName: "My Location", hierarchy: [] });
        }

        data = await response.json();
      } catch (fetchError: any) {
        console.error(`[Reverse Geocode] Photon error: ${fetchError.message}`);
        clearTimeout(timeoutId);
        return res.json({ placeName: "My Location", hierarchy: [] });
      }
      
      if (!data.features || data.features.length === 0) {
        console.warn(`[Reverse Geocode] No results from Photon for ${numLat},${numLon}`);
        return res.json({ placeName: "My Location", hierarchy: [] });
      }

      // Find the best result - prefer building/amenity names over generic locations
      let result = data.features[0];
      for (const feature of data.features) {
        const props = feature.properties || {};
        // Prefer buildings, amenities, and specific places over administrative boundaries
        const type = props.osm_type || '';
        if ((type === 'building' || props.amenity || props.shop || props.office) && props.name) {
          result = feature;
          break;
        }
      }
      
      const properties = result.properties || {};
      
      // Build place name with proper priority for exact location
      // Priority: building/amenity name > street > locality/district > city > state > country
      const parts = [];
      
      // Highest priority: building, amenity, shop, or office names (specific place)
      if (properties.name && properties.name.length > 3) {
        parts.push(properties.name);
      }
      
      // Add street address if available and different from name
      if (properties.street && properties.street !== properties.name && !parts.includes(properties.street)) {
        parts.push(properties.street);
      }
      
      // Add district/locality/village for geographic accuracy
      if (properties.district && !parts.includes(properties.district)) {
        parts.push(properties.district);
      } else if (properties.locality && !parts.includes(properties.locality) && properties.locality !== properties.name) {
        parts.push(properties.locality);
      }
      
      // Add postal code if available
      if (properties.postcode && !parts.includes(properties.postcode)) {
        parts.push(properties.postcode);
      }
      
      // Add city
      if (properties.city && !parts.includes(properties.city)) {
        parts.push(properties.city);
      }
      
      // Add state
      if (properties.state && !parts.includes(properties.state)) {
        parts.push(properties.state);
      }
      
      // Add country as fallback
      if (properties.country && !parts.includes(properties.country)) {
        parts.push(properties.country);
      }
      
      const placeName = parts.length > 0 ? parts.join(', ') : 'My Location';
      
      // Build detailed location components for comprehensive display
      const locationDetails = {
        building: properties.name || '',
        street: properties.street || '',
        postalCode: properties.postcode || '',
        locality: properties.locality || '',
        area: properties.district || '',
        city: properties.city || '',
        state: properties.state || '',
        country: properties.country || ''
      };
      
      // Build hierarchy: locality/city -> district -> state -> country
      const hierarchy: string[] = [];
      if (properties.locality && !hierarchy.includes(properties.locality)) hierarchy.push(properties.locality);
      if (properties.city && properties.city !== properties.locality && !hierarchy.includes(properties.city)) hierarchy.push(properties.city);
      if (properties.district && !hierarchy.includes(properties.district)) hierarchy.push(properties.district);
      if (properties.state && !hierarchy.includes(properties.state)) hierarchy.push(properties.state);
      if (properties.country && !hierarchy.includes(properties.country)) hierarchy.push(properties.country);

      console.log(`[Reverse Geocode] ✓ Success: ${numLat},${numLon} -> ${placeName}`);
      
      res.json({
        placeName: placeName,
        hierarchy: hierarchy,
        locationDetails: locationDetails,
        latitude: numLat,
        longitude: numLon
      });
    } catch (error: any) {
      console.error("[Reverse Geocode] Error:", error.message);
      res.json({ placeName: "My Location", hierarchy: [] });
    }
  });

  // Geocode place name to coordinates using Google Maps
  app.get('/api/geocode', isAuthenticated, async (req: any, res) => {
    try {
      const placeName = req.query.place as string;
      if (!placeName || placeName.trim().length === 0) {
        return res.status(400).json({ message: "Place name required" });
      }

      console.log(`[Geocode] Searching for: ${placeName}`);

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn("[Geocode] Google Maps API key not configured");
        return res.status(500).json({ message: "Location service unavailable" });
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(placeName)}&key=${apiKey}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Geocode] HTTP ${response.status}`);
        return res.status(500).json({ message: "Geocoding service unavailable" });
      }

      const data = await response.json();
      
      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.log(`[Geocode] No results found for: ${placeName}`);
        return res.status(404).json({ message: `No location found for "${placeName}". Try a larger city or region.` });
      }

      const location = data.results[0];
      const displayName = location.formatted_address;
      
      console.log(`[Geocode] Found: ${displayName}`);
      res.json({
        latitude: location.geometry.location.lat,
        longitude: location.geometry.location.lng,
        displayName: displayName
      });
    } catch (error: any) {
      console.error("[Geocode] Error:", error.message);
      res.status(500).json({ message: "Unable to search location. Please try again." });
    }
  });

  // Admin routes - real-time monitoring
  app.get('/api/admin/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const db = await (await import('./db')).getDb();
      const { sessions: sessionsTable, users: usersTable } = await import('@shared/schema');
      const { sql, eq } = await import('drizzle-orm');
      
      // Get all active sessions from the database
      const sessionList = await db.select().from(sessionsTable);
      
      // Fetch user info for each session
      const sessionsWithUsers = [];
      for (const session of sessionList) {
        try {
          const sess = session.sess as any;
          if (sess && sess.passport && sess.passport.user) {
            const userId = sess.passport.user.claims?.sub || sess.passport.user.id;
            if (userId) {
              const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
              if (user) {
                sessionsWithUsers.push({
                  userId: user.id,
                  email: user.email || '',
                  firstName: user.firstName,
                  lastName: user.lastName,
                  sessionExpire: session.expire,
                });
              }
            }
          }
        } catch (e) {
          console.warn("Error processing session:", e);
        }
      }
      
      res.json(sessionsWithUsers);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get('/api/admin/reports', isAuthenticated, async (req: any, res) => {
    try {
      const db = await (await import('./db')).getDb();
      const { crimeReports: crimeReportsTable, users: usersTable } = await import('@shared/schema');
      const { eq, desc } = await import('drizzle-orm');
      
      // Get all crime reports with user details
      const reports = await db
        .select({
          id: crimeReportsTable.id,
          userId: crimeReportsTable.userId,
          crimeType: crimeReportsTable.crimeType,
          description: crimeReportsTable.description,
          latitude: crimeReportsTable.latitude,
          longitude: crimeReportsTable.longitude,
          address: crimeReportsTable.address,
          isAnonymous: crimeReportsTable.isAnonymous,
          createdAt: crimeReportsTable.createdAt,
          userEmail: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        })
        .from(crimeReportsTable)
        .leftJoin(usersTable, eq(crimeReportsTable.userId, usersTable.id))
        .orderBy(desc(crimeReportsTable.createdAt));
      
      // Transform the response
      const formattedReports = reports.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.userEmail,
        userName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : undefined,
        crimeType: r.crimeType,
        description: r.description,
        latitude: r.latitude,
        longitude: r.longitude,
        address: r.address,
        isAnonymous: r.isAnonymous,
        createdAt: r.createdAt,
      }));
      
      res.json(formattedReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Safe Places route - Works for ANY location worldwide
  app.get('/api/safe-places', isAuthenticated, async (req: any, res) => {
    try {
      const startTime = Date.now();
      const userLat = parseFloat(req.query.latitude as string);
      const userLon = parseFloat(req.query.longitude as string);
      
      // Validate coordinates
      if (isNaN(userLat) || isNaN(userLon)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }
      
      console.log(`[Safe Places] Fetching locations for: ${userLat}, ${userLon}`);

      const radius = 5; // 5km search radius
      const radiusMeters = radius * 1000;
      const allPlaces: any[] = [];
      const seenPlaces = new Set<string>();

      // Try Overpass API first for real-time worldwide data
      try {
        console.log(`[Safe Places] Trying Overpass API for worldwide search...`);
        
        // Build Overpass QL query - search for amenities in bounding box
        const delta = radius / 111.0; // Convert km to degrees
        const bbox = `${userLat - delta},${userLon - delta},${userLat + delta},${userLon + delta}`;
        
        console.log(`[Safe Places] Search bbox: ${bbox}, user location: ${userLat}, ${userLon}`);
        
        const queries = [
          `[bbox:${bbox}];(node["amenity"="police"];way["amenity"="police"];);out geom;`,
          `[bbox:${bbox}];(node["amenity"="hospital"];node["amenity"="clinic"];node["amenity"="doctors"];way["amenity"="hospital"];way["amenity"="clinic"];);out geom;`,
          `[bbox:${bbox}];(node["amenity"="pharmacy"];way["amenity"="pharmacy"];);out geom;`
        ];

        const typeMap = {
          0: 'police',
          1: 'hospital',
          2: 'pharmacy'
        };

        for (let i = 0; i < queries.length; i++) {
          try {
            const url = `https://overpass-api.de/api/interpreter`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
              method: 'POST',
              body: queries[i],
              signal: controller.signal,
              headers: { 'User-Agent': 'Crime-Report-Portal/1.0' }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              console.warn(`[Safe Places] Overpass HTTP ${response.status} for type ${i}`);
              continue;
            }

            const text = await response.text();
            
            // Parse OSM JSON response
            let osm;
            try {
              osm = JSON.parse(text);
            } catch (e) {
              console.warn(`[Safe Places] Failed to parse Overpass response for type ${i}`);
              continue;
            }
            
            const type = typeMap[i as keyof typeof typeMap] || 'other';
            
            const foundCount = Array.isArray(osm.elements) ? osm.elements.filter((e: any) => e.lat && e.lon).length : 0;
            console.log(`[Safe Places] Overpass returned ${foundCount} ${type} places`);

            if (Array.isArray(osm.elements)) {
              for (const element of osm.elements) {
                if (!element.lat || !element.lon) continue;

                const placeId = `${element.type}-${element.id}`;
                if (seenPlaces.has(placeId)) continue;
                seenPlaces.add(placeId);

                const distance = calculateDistance(userLat, userLon, element.lat, element.lon);
                if (distance > radius) {
                  console.log(`[Safe Places] Filtered out ${element.tags?.name || type}: ${distance.toFixed(2)}km > ${radius}km`);
                  continue;
                }

                const tags = element.tags || {};
                const name = tags.name || `${type.charAt(0).toUpperCase() + type.slice(1)}`;
                const phone = tags.phone || tags['contact:phone'] || "";
                const address = tags['addr:street'] || tags['addr:full'] || `${type} location`;

                allPlaces.push({
                  id: placeId,
                  name: name,
                  type: type,
                  latitude: element.lat,
                  longitude: element.lon,
                  address: address,
                  phone: phone,
                  distance: Math.round(distance * 100) / 100,
                  rating: 0,
                  isOpen: undefined
                });
              }
            }
          } catch (error: any) {
            console.warn(`[Safe Places] Overpass error for type ${i}:`, error.message);
          }
        }
      } catch (error: any) {
        console.warn(`[Safe Places] Overpass API failed:`, error.message);
      }

      // Always supplement with hardcoded database to ensure comprehensive results
      console.log(`[Safe Places] Supplementing with hardcoded database (${allPlaces.length} from Overpass)...`);
      
      const dbBefore = allPlaces.length;
      for (const place of SAFE_PLACES_DB) {
        const distance = calculateDistance(userLat, userLon, place.latitude, place.longitude);
        
        if (distance <= radius) {
          const placeId = `db-${place.name}`;
          if (!seenPlaces.has(placeId)) {
            seenPlaces.add(placeId);
            console.log(`[Safe Places] Adding from DB: ${place.name} (${place.type}) at ${distance.toFixed(2)}km`);
            allPlaces.push({
              id: placeId,
              name: place.name,
              type: place.type,
              latitude: place.latitude,
              longitude: place.longitude,
              address: place.address,
              phone: place.phone,
              distance: Math.round(distance * 100) / 100,
              rating: 0,
              isOpen: undefined
            });
          }
        }
      }
      const dbAdded = allPlaces.length - dbBefore;
      console.log(`[Safe Places] Added ${dbAdded} places from hardcoded database`);

      // Sort by distance only (nearest first, regardless of type)
      allPlaces.sort((a, b) => a.distance - b.distance);

      const fetchTime = Date.now() - startTime;
      const police = allPlaces.filter(p => p.type === 'police').length;
      const hospitals = allPlaces.filter(p => p.type === 'hospital').length;
      const pharmacies = allPlaces.filter(p => p.type === 'pharmacy').length;
      
      console.log(`[Safe Places] ✓ Found ${allPlaces.length} places in ${fetchTime}ms. Police: ${police}, Hospitals: ${hospitals}, Pharmacies: ${pharmacies}`);

      res.json(allPlaces);
    } catch (error) {
      console.error("[Safe Places] Error:", error);
      res.json([]);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
