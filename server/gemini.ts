// From javascript_gemini blueprint - Crime analysis functions
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface CrimeAnalysis {
  analysis: string;
  recommendations: string[];
  selfDefenseRecommendations: string[];
}

export async function analyzeCrimePatterns(crimeData: any[]): Promise<CrimeAnalysis> {
  if (crimeData.length === 0) {
    return {
      analysis: "No crime data available for analysis",
      recommendations: ["Report crimes in your area to help improve safety insights"],
      selfDefenseRecommendations: [
        "Stay alert and aware of your surroundings",
        "Trust your instincts and avoid suspicious situations",
        "Keep emergency contacts easily accessible"
      ],
    };
  }

  try {
    const crimesSummary = crimeData.slice(0, 20).map(c => ({
      type: c.crimeType,
      date: c.reportedAt,
      description: c.description?.substring(0, 100),
    }));

    const prompt = `Analyze these crime reports and provide safety insights with self-defense recommendations:
${JSON.stringify(crimesSummary, null, 2)}

Provide:
1. A brief analysis of crime patterns (2-3 sentences)
2. 3-5 safety recommendations
3. 3-5 specific self-defense recommendations based on the crime types reported (include practical techniques and awareness tips)

Respond in JSON format: {"analysis": "...", "recommendations": ["...", "..."], "selfDefenseRecommendations": ["...", "..."]}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            analysis: { type: "string" },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            selfDefenseRecommendations: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["analysis", "recommendations", "selfDefenseRecommendations"],
        },
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      const data: CrimeAnalysis = JSON.parse(rawJson);
      return data;
    } else {
      throw new Error("Empty response from model");
    }
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return {
      analysis: "Unable to analyze crime patterns at this time",
      recommendations: ["Stay aware of your surroundings", "Report suspicious activity"],
      selfDefenseRecommendations: [
        "Stay in well-lit, populated areas",
        "Keep your phone charged with emergency contacts saved",
        "Trust your instincts - leave situations that feel unsafe",
        "Take a self-defense class to build confidence",
        "Practice de-escalation techniques and avoid confrontation"
      ],
    };
  }
}

export async function generateSafetyRecommendations(location: { latitude: number; longitude: number }, recentCrimes: any[]): Promise<string[]> {
  try {
    const prompt = `Based on ${recentCrimes.length} recent crimes near coordinates ${location.latitude}, ${location.longitude}, provide 5 personalized safety recommendations.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    return lines.slice(0, 5);
  } catch (error) {
    console.error("Safety recommendations error:", error);
    return [
      "Stay in well-lit areas at night",
      "Keep emergency contacts updated",
      "Be aware of your surroundings",
    ];
  }
}
