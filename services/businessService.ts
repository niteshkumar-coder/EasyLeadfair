
import { GoogleGenAI, Type } from "@google/genai";
import { BusinessLead, SearchQuery } from "../types";

export async function findBusinessLeads(
  query: SearchQuery,
  userLocation?: { lat: number; lng: number }
): Promise<BusinessLead[]> {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY_MISSING: Please add your Gemini API Key to your Deployment Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const { city, categories, radius } = query;

  const categoriesStr = categories.join(', ');
  
  const systemInstruction = `You are a Professional Lead Intelligence Auditor.
Your objective is to find high-quality business leads for "${categoriesStr}" in "${city}, India".

STRICT DATA EXTRACTION RULES (MANDATORY):
1. SOURCE VERIFICATION: You MUST use the Google Search tool to find live Google Business Profiles.
2. ACCURACY: Extract the ACTUAL "formatted_phone_number" field from the Google listing. 
3. NO HALLUCINATION: If a phone number is NOT found on the official profile, return null. DO NOT guess or provide placeholders like "0000000000".
4. REAL DETAILS ONLY: Only return details (Email, Website) if they are explicitly listed on the business profile or their official website.
5. QUANTITY: Provide a list of up to 30 highly verified businesses.
6. FORMAT: Output only a clean JSON array of lead objects.`;

  const prompt = `Find and verify up to 30 business leads for "${categoriesStr}" in "${city}". 
Use Google Search to ensure the "formatted_phone_number", "website", and "email" are REAL and taken directly from their Google Business Profile. 
If no contact number is listed on their profile, return null for that field. 
JSON Fields: name, address, formatted_phone_number, email, website, maps_url, rating, userRatingsTotal, lat, lng.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
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
              formatted_phone_number: { 
                type: Type.STRING, 
                nullable: true,
                description: "Exact contact number from Google Profile."
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

    let text = response.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) text = jsonMatch[0];

    const results = JSON.parse(text);
    if (!Array.isArray(results)) return [];

    return results.map((item: any, index: number) => {
      const lat = Number(item.lat) || 0;
      const lng = Number(item.lng) || 0;
      const name = item.name || "Business Name";
      const address = item.address || "Address not available";

      // Post-extraction sanitization to block AI hallucinations
      let phone = item.formatted_phone_number ? String(item.formatted_phone_number).trim() : null;
      if (phone) {
        const lowerPhone = phone.toLowerCase();
        const cleanDigits = phone.replace(/[^0-9]/g, '');
        if (
          lowerPhone.includes('null') || 
          lowerPhone.includes('n/a') || 
          lowerPhone.includes('none') || 
          lowerPhone.includes('available') ||
          cleanDigits.length < 8 ||
          /^(.)\1+$/.test(cleanDigits)
        ) {
          phone = null;
        }
      }

      let email = item.email ? String(item.email).trim() : null;
      if (email && (email.toLowerCase().includes('example') || !email.includes('@'))) {
        email = null;
      }

      return {
        id: `lead-${Date.now()}-${index}`,
        name,
        address,
        phone,
        website: item.website || null,
        email: email,
        owner: null,
        lat,
        lng,
        distance: null,
        source: 'Google Search',
        mapsUrl: item.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + address)}`,
        lastUpdated: new Date().toISOString().split('T')[0],
        rating: item.rating || null,
        userRatingsTotal: item.userRatingsTotal || null
      };
    });

  } catch (error: any) {
    console.error("API Error:", error);
    // Return empty array to trigger the "No results found" UI state
    return [];
  }
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
