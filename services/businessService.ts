
import { GoogleGenAI, Type } from "@google/genai";
import { BusinessLead, SearchQuery } from "../types";

/**
 * Exponential backoff helper for handling rate limits (429 errors).
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED");
    if (isRateLimit && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

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
  
  const systemInstruction = `You are a professional lead generation assistant.
Find active businesses in "${city}, India" for the category "${categoriesStr}".
Use the googleSearch tool to verify contact details.
Prioritize verified businesses with real phone numbers.`;

  const prompt = `Find up to 20 verified business leads for "${categoriesStr}" in "${city}".
Return a JSON array of objects with: name, address, formatted_phone_number, website, email, rating, userRatingsTotal, lat, lng.`;

  return retryWithBackoff(async () => {
    try {
      const response = await ai.models.generateContent({
        // Using Flash Lite as it has higher availability and lower rate-limiting on free tiers
        model: "gemini-flash-lite-latest", 
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
                formatted_phone_number: { type: Type.STRING, nullable: true },
                email: { type: Type.STRING, nullable: true },
                website: { type: Type.STRING, nullable: true },
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
      
      if (!Array.isArray(results)) results = results ? [results] : [];

      return results.map((item: any, index: number) => ({
        id: `lead-${Date.now()}-${index}`,
        name: item.name || "Business",
        address: item.address || "Address not found",
        phone: item.formatted_phone_number || null,
        website: item.website || null,
        email: item.email || null,
        lat: Number(item.lat) || 0,
        lng: Number(item.lng) || 0,
        distance: null,
        source: 'Google Search',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + item.address)}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        rating: item.rating || null,
        userRatingsTotal: item.userRatingsTotal || null
      }));

    } catch (error: any) {
      const msg = error.message || "";
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        throw new Error("QUOTA_EXCEEDED");
      }
      throw error;
    }
  });
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
