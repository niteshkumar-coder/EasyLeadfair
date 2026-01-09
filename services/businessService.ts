
import { GoogleGenAI, Type } from "@google/genai";
import { BusinessLead, SearchQuery } from "../types";

/**
 * Enhanced Lead Finder using Gemini 3 Flash.
 * Optimized for high-speed, grounded search with better rate-limit handling.
 */
export async function findBusinessLeads(
  query: SearchQuery,
  userLocation?: { lat: number; lng: number }
): Promise<BusinessLead[]> {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  const { city, categories } = query;
  const categoriesStr = categories.join(', ');
  
  // Minimalist system instruction to save input tokens
  const systemInstruction = `Find active businesses in "${city}, India" for "${categoriesStr}". 
Use Google Search tool. Return verified leads with phone numbers.`;

  const prompt = `Find up to 15 verified leads for "${categoriesStr}" in "${city}". 
Include: name, address, phone, website, email, rating, reviews_count, lat, lng.`;

  try {
    const response = await ai.models.generateContent({
      // Gemini 3 Flash has the highest free-tier quota and best grounding support
      model: "gemini-3-flash-preview", 
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              phone: { type: Type.STRING, nullable: true },
              email: { type: Type.STRING, nullable: true },
              website: { type: Type.STRING, nullable: true },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              rating: { type: Type.NUMBER, nullable: true },
              reviews_count: { type: Type.INTEGER, nullable: true }
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
    
    if (!Array.isArray(results)) results = results ? [results] : [];

    return results.map((item: any, index: number) => ({
      id: `lead-${Date.now()}-${index}`,
      name: item.name || "Business",
      address: item.address || "No address found",
      phone: item.phone || null,
      website: item.website || null,
      email: item.email || null,
      lat: Number(item.lat) || 0,
      lng: Number(item.lng) || 0,
      distance: null,
      source: 'Google Search',
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.address)}`,
      lastUpdated: new Date().toISOString().split('T')[0],
      rating: item.rating || null,
      userRatingsTotal: item.reviews_count || null
    }));

  } catch (error: any) {
    console.error("Business Service Error:", error);
    const msg = error.message || "";
    // Detect quota or rate limit errors specifically
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      throw new Error("QUOTA_EXCEEDED");
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
