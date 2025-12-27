
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

export const analyzeImage = async (base64Data: string, mimeType: string): Promise<AnalysisResult> => {
  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
  
  const prompt = `Analyze this image to determine its date and location using your internal knowledge. 
  1. Identify the specific location name in Japanese (e.g. "東京都 千代田区の皇居外苑付近").
  2. Identify the Country explicitly.
  3. Provide precise Latitude and Longitude coordinates based on your knowledge of the scene. If uncertain, provide your best estimate.
  4. Determine the date (format as YYYY/MM/DD). 
  5. Provide a very short description (max 5 words).`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            locationName: { type: Type.STRING },
            country: { type: Type.STRING },
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER },
            date: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["locationName", "latitude", "longitude", "date", "description"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
      locationName: "不明な場所",
      country: "不明",
      latitude: 0,
      longitude: 0,
      date: new Date().toLocaleDateString('ja-JP'),
      description: "解析に失敗しました"
    };
  }
};

/**
 * 座標と画像から場所名をAIに推測させる
 */
export const identifyLocation = async (lat: number, lng: number, base64Data: string, mimeType: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `この写真は緯度: ${lat}, 経度: ${lng} の地点に配置されました。
  画像の内容とこの座標情報から、ここがどこであるかをあなたの知識で特定し、具体的な場所名を日本語で返してください（例：「福岡県 福津市の宮地浜海水浴場付近」）。
  余計な説明は省き、場所の名前のみを返してください。`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
    });
    return response.text?.trim() || "特定された地点";
  } catch (error) {
    console.error("AI Location Identification Error:", error);
    return "特定できませんでした";
  }
};

