
import { GoogleGenAI } from "@google/genai";
import { BusinessLead, SearchQuery } from "../types";

/**
 * Enhanced Lead Finder using Gemini 3 Flash.
 * Optimized for high-speed, grounded search with better rate-limit handling.
 */
export async function findBusinessLeads(
  query: SearchQuery,
  userLocation?: { lat: number; lng: number }
): Promise<BusinessLead[]> {
  // Check for API key existence
  if (!process.env.API_KEY || process.env.API_KEY === "undefined" || process.env.API_KEY === "") {
    throw new Error("API_KEY_MISSING");
  }

  // Initialize GenAI with the API key directly from environment variables per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { city, categories } = query;
  const categoriesStr = categories.join(', ');
  
  // Minimalist system instruction. 
  // We specify JSON output in the prompt because responseMimeType is incompatible with tools.
  const systemInstruction = `You are a professional business lead generator. 
Search for real businesses in "${city}, India" matching "${categoriesStr}". 
Use the googleSearch tool to verify their existence and contact details. 
You MUST provide your response strictly as a JSON array of objects.`;

  const prompt = `Find up to 15 verified leads for "${categoriesStr}" in "${city}". 
Return ONLY a valid JSON array. Each object must have: 
"name", "address", "phone", "website", "email", "rating", "reviews_count", "lat", "lng", "owner".

Example format:
[
  {
    "name": "Business Name",
    "address": "123 Street, City",
    "phone": "+91 98765 43210",
    "website": "example.com",
    "email": "info@example.com",
    "rating": 4.5,
    "reviews_count": 120,
    "lat": 28.6139,
    "lng": 77.2090,
    "owner": "Owner Name"
  }
]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        // responseMimeType: "application/json" is REMOVED because it causes 400 error when used with tools
      }
    });

    const text = response.text || "";
    
    // Robustly extract JSON from the text response
    let results: any[] = [];
    try {
      // Find the first '[' and last ']' to extract the JSON array block
      const startIdx = text.indexOf('[');
      const endIdx = text.lastIndexOf(']');
      
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = text.substring(startIdx, endIdx + 1);
        results = JSON.parse(jsonStr);
      } else {
        // Fallback: try parsing the whole thing if no brackets found
        results = JSON.parse(text);
      }
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw Text:", text);
      throw new Error("The AI returned data in an unexpected format. Please try your search again.");
    }
    
    if (!Array.isArray(results)) {
      results = results ? [results] : [];
    }

    return results.map((item: any, index: number) => {
      // Basic sanitization of data
      const lat = Number(item.lat) || 0;
      const lng = Number(item.lng) || 0;
      
      // Fix: Add missing 'owner' property to satisfy BusinessLead interface requirements
      return {
        id: `lead-${Date.now()}-${index}`,
        name: item.name || "Business",
        address: item.address || "Address not found",
        phone: item.phone || null,
        website: item.website || null,
        email: item.email || null,
        lat: lat,
        lng: lng,
        distance: null,
        owner: item.owner || null,
        source: 'Google Search',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.address)}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        rating: item.rating || null,
        userRatingsTotal: item.reviews_count || null
      };
    });

  } catch (error: any) {
    console.error("Business Service Error:", error);
    const msg = error.message || "";
    
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    
    if (msg.includes("INVALID_ARGUMENT")) {
      throw new Error("The search engine configuration encountered a conflict. We are working to resolve this.");
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
