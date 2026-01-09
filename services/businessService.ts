
import { GoogleGenAI, Type } from "@google/genai";
import { BusinessLead, SearchQuery } from "../types";

/**
 * Enhanced Lead Finder using Gemini 3 Pro with Grounded Search.
 * Optimized for resilience and discovery in Indian cities.
 */
export async function findBusinessLeads(
  query: SearchQuery,
  userLocation?: { lat: number; lng: number }
): Promise<BusinessLead[]> {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY_MISSING: The Gemini API Key is missing. Please check your deployment settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const { city, categories, radius } = query;
  const categoriesStr = categories.join(', ');
  
  // Refined instructions: be accurate but don't fail if you can't find a high count.
  const systemInstruction = `You are an expert Indian Business Intelligence Agent.
Your mission is to discover and verify active businesses in "${city}, India" for categories: "${categoriesStr}".

SEARCH PROTOCOL:
1. Use the googleSearch tool to perform multiple detailed queries for "${categoriesStr} in ${city}".
2. Look for official Google Business Profiles, Justdial listings, and local directories.
3. Extract real contact numbers, websites, and physical addresses.
4. If a specific field (like phone or email) is not found, use null.
5. Avoid hallucinations. Only return businesses you can confirm actually exist in ${city}.
6. Prioritize quality and verification over quantity. If you find only 5 highly verified leads, return those 5 rather than returning nothing.`;

  const prompt = `Find as many verified business leads as possible (up to 20) for "${categoriesStr}" in the city of "${city}".
Provide:
- Business name
- Formatted contact number (from Google Maps/Profile)
- Verified Website URL
- Official Email (if available)
- Physical Address
- Rating and review count
- Map Latitude and Longitude for plotting.

Ensure all businesses are physically located within or very close to ${city}, India.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 8000 }, // Added thinking budget to improve data quality and verification
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              formatted_phone_number: { 
                type: Type.STRING, 
                nullable: true,
                description: "The business phone number found on Google Maps."
              },
              email: { type: Type.STRING, nullable: true },
              website: { type: Type.STRING, nullable: true },
              maps_url: { type: Type.STRING, nullable: true },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              rating: { type: Type.NUMBER, nullable: true },
              userRatingsTotal: { type: Type.INTEGER, nullable: true }
            },
            required: ["name", "address", "lat", "lng"]
          }
        }
      }
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const cleanedJson = jsonMatch ? jsonMatch[0] : text;

    let results = JSON.parse(cleanedJson);
    if (!Array.isArray(results)) {
      results = results ? [results] : [];
    }

    return results.map((item: any, index: number) => {
      // Basic sanitization
      let phone = item.formatted_phone_number ? String(item.formatted_phone_number).trim() : null;
      if (phone) {
        const digits = phone.replace(/[^0-9]/g, '');
        // Filter out common AI-generated placeholders
        if (digits.length < 8 || /^(.)\1+$/.test(digits) || digits === '1234567890') {
          phone = null;
        }
      }

      return {
        id: `lead-${Date.now()}-${index}`,
        name: item.name || "Business",
        address: item.address || "No address found",
        phone,
        website: item.website || null,
        email: item.email || null,
        owner: null,
        lat: Number(item.lat) || 0,
        lng: Number(item.lng) || 0,
        distance: null,
        source: 'Google Search',
        mapsUrl: item.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.address)}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        rating: item.rating || null,
        userRatingsTotal: item.userRatingsTotal || null
      };
    });

  } catch (error: any) {
    console.error("Search failed:", error);
    // Rethrow to allow App.tsx to handle the specific error message
    throw new Error(error.message || "The AI search engine encountered an issue. Please try again with a simpler category.");
  }
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
