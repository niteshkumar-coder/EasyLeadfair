
import { GoogleGenAI } from "@google/genai";
import { BusinessLead, SearchQuery } from "../types";

/**
 * Lead Finder Service using Gemini 3 Flash with Search Grounding.
 */
export async function findBusinessLeads(
  query: SearchQuery,
  userLocation?: { lat: number; lng: number }
): Promise<BusinessLead[]> {
  // Always use the latest key from the environment
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  const { city, categories } = query;
  const categoriesStr = categories.join(', ');
  
  // Note: responseMimeType and responseSchema MUST NOT be used with tools like googleSearch.
  // We strictly define the JSON structure in the system instruction and prompt instead.
  const systemInstruction = `You are a professional lead generation expert for the Indian market.
Your task is to find real, active businesses in "${city}, India" matching the categories: "${categoriesStr}".
Use the googleSearch tool to verify contact details, ratings, and locations.
Output your findings ONLY as a valid JSON array. No conversational text before or after the JSON.`;

  const prompt = `Find up to 15 verified business leads for "${categoriesStr}" in "${city}".
For each business, provide:
- "name": Full business name
- "address": Complete physical address
- "phone": Formatted phone number (with +91)
- "website": Official website URL
- "email": Contact email address
- "rating": Numeric rating (e.g. 4.5)
- "reviews_count": Total number of reviews
- "lat": Latitude coordinate
- "lng": Longitude coordinate
- "owner": Name of the owner or manager

Return only the JSON array:
[
  {
    "name": "...",
    "address": "...",
    "phone": "...",
    "website": "...",
    "email": "...",
    "rating": 4.5,
    "reviews_count": 100,
    "lat": 0.0,
    "lng": 0.0,
    "owner": "..."
  }
]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        // responseMimeType: "application/json" and responseSchema are omitted to prevent 400 errors with tools
      }
    });

    const text = response.text || "";
    
    // Robust JSON extraction
    let results: any[] = [];
    try {
      const startIdx = text.indexOf('[');
      const endIdx = text.lastIndexOf(']');
      
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = text.substring(startIdx, endIdx + 1);
        results = JSON.parse(jsonStr);
      } else {
        // Fallback if no brackets found
        results = JSON.parse(text);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", text);
      throw new Error("The search engine returned an invalid data format. Please try again with a more specific category.");
    }
    
    if (!Array.isArray(results)) {
      results = results ? [results] : [];
    }

    return results.map((item: any, index: number) => {
      const lat = Number(item.lat) || 0;
      const lng = Number(item.lng) || 0;
      
      return {
        id: `lead-${Date.now()}-${index}`,
        name: item.name || "Business Entity",
        address: item.address || "Address unavailable",
        phone: item.phone || null,
        website: item.website || null,
        email: item.email || null,
        lat: lat,
        lng: lng,
        distance: null,
        owner: item.owner || "Not identified",
        source: 'Google Search',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((item.name || '') + ' ' + (item.address || ''))}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        rating: item.rating || null,
        userRatingsTotal: item.reviews_count || null
      };
    });

  } catch (error: any) {
    console.error("Business Service Error:", error);
    const msg = error.message || "";
    
    // Handle specific API error codes
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    
    if (msg.includes("400") || msg.includes("INVALID_ARGUMENT")) {
      throw new Error("The search parameters are currently causing a conflict with the grounding tool. Try searching for a single category.");
    }
    
    throw error;
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
