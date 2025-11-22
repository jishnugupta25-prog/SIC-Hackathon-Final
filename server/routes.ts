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

  // Safe Places route - fetches comprehensive real locations with phone numbers from OpenStreetMap
  app.get('/api/safe-places', isAuthenticated, async (req: any, res) => {
    try {
      const userLat = parseFloat(req.query.latitude as string);
      const userLon = parseFloat(req.query.longitude as string);
      
      // Validate coordinates
      if (isNaN(userLat) || isNaN(userLon)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }
      
      console.log(`[Safe Places] Fetching comprehensive locations for: ${userLat}, ${userLon}`);
      
      // Comprehensive search types with multiple amenity variations
      const searchTypes = [
        // Hospitals and medical facilities
        { amenities: ["hospital", "clinic", "emergency_ward"], type: "hospital", radius: 0.1 },
        // Police stations and law enforcement
        { amenities: ["police", "fire_station", "ambulance_station"], type: "police", radius: 0.1 },
        // Pharmacies and medicine shops
        { amenities: ["pharmacy", "chemist"], type: "pharmacy", radius: 0.1 },
        // Safe zones and community centers
        { amenities: ["community_centre", "community_center", "shelter"], type: "safe_zone", radius: 0.1 },
      ];

      let allPlaces: any[] = [];

      for (const searchType of searchTypes) {
        for (const amenity of searchType.amenities) {
          try {
            // Larger search radius to capture more results
            const bbox = `${userLon - searchType.radius},${userLat - searchType.radius},${userLon + searchType.radius},${userLat + searchType.radius}`;
            
            // Primary search using Nominatim with better parameters
            const url = `https://nominatim.openstreetmap.org/search?q=[${amenity}]&viewbox=${bbox}&bounded=1&format=json&limit=50&addressdetails=1`;
            
            const response = await fetch(url, {
              headers: { 'User-Agent': 'CrimeReportPortal/1.0' }
            });

            if (response.ok) {
              const data = await response.json();
              
              if (Array.isArray(data) && data.length > 0) {
                data.forEach((location: any, idx: number) => {
                  try {
                    const lat = parseFloat(location.lat);
                    const lon = parseFloat(location.lon);
                    
                    if (isNaN(lat) || isNaN(lon)) return;
                    
                    const distance = calculateDistance(userLat, userLon, lat, lon);
                    
                    // Extract phone number from multiple possible locations
                    let phone = '';
                    if (location.address?.phone) {
                      phone = location.address.phone;
                    } else if (location.phone) {
                      phone = location.phone;
                    } else if (location.extratags?.phone) {
                      phone = location.extratags.phone;
                    } else if (location.display_name?.includes('phone')) {
                      // Try to extract from display name if available
                      const phoneMatch = location.display_name.match(/\d{3,}[-.\d]/);
                      phone = phoneMatch ? phoneMatch[0] : '';
                    }
                    
                    // Determine name from various sources
                    let name = location.name || 
                      location.display_name?.split(',')[0] || 
                      location.address?.name ||
                      'Unknown Location';
                    
                    // Filter out generic results that are likely not actual places
                    if (name.length < 2 || name === 'Unknown Location') {
                      return;
                    }
                    
                    const placeId = `${searchType.type}-${Math.round(lat * 10000)}-${Math.round(lon * 10000)}`;
                    
                    allPlaces.push({
                      id: placeId,
                      name: name.trim(),
                      type: searchType.type,
                      latitude: lat,
                      longitude: lon,
                      address: location.display_name || 'No address available',
                      phone: phone.trim(),
                      distance: Math.round(distance * 1000) / 1000, // Round to 3 decimals (more precise)
                    });
                  } catch (itemError) {
                    console.warn(`[Safe Places] Error processing location item:`, itemError);
                  }
                });
              }
            }
          } catch (error) {
            console.warn(`[Safe Places] Error searching for ${amenity}:`, error);
          }
          
          // Add small delay between requests to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Remove duplicates (same location, different search results)
      const uniquePlaces: any[] = [];
      const seenLocations = new Map<string, any>();

      for (const place of allPlaces) {
        // Use rounded coordinates as key to detect duplicates
        const locKey = `${Math.round(place.latitude * 100)},${Math.round(place.longitude * 100)}`;
        
        if (!seenLocations.has(locKey)) {
          seenLocations.set(locKey, place);
        } else {
          // If duplicate found, keep the one with phone number
          const existing = seenLocations.get(locKey);
          if (place.phone && !existing.phone) {
            seenLocations.set(locKey, place);
          }
        }
      }

      // Convert map to array and sort by distance
      const sortedPlaces = Array.from(seenLocations.values())
        .sort((a, b) => a.distance - b.distance);
      
      // Return all places (or limit if too many)
      const safePlaces = sortedPlaces.slice(0, 50); // Return up to 50 places
      
      console.log(`[Safe Places] Found ${safePlaces.length} unique places. ${safePlaces.filter(p => p.phone).length} have phone numbers.`);
      if (safePlaces[0]) {
        console.log(`[Safe Places] Closest: ${safePlaces[0].name} (${safePlaces[0].distance}km, Phone: ${safePlaces[0].phone || 'N/A'})`);
      }

      res.json(safePlaces);
    } catch (error) {
      console.error("Error fetching safe places:", error);
      res.status(500).json({ message: "Failed to fetch safe places" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
