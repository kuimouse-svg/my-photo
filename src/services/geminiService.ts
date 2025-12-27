import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisResult } from "../types";

const MODEL_NAME = 'gemini-1.5-flash'; // 安定したモデル名に変更

export const analyzeImage = async (base64Data: string, mimeType: string): Promise<AnalysisResult> => {
  // import.meta as any で環境変数を取得
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const prompt = `Analyze this image to determine its date and location using your internal knowledge. 
  1. Identify the specific location name in Japanese (e.g. "東京都 千代田区の皇居外苑付近").
  2. Identify the Country explicitly.
  3. Provide precise Latitude and Longitude coordinates based on your knowledge of the scene.
  4. Determine the date (format as YYYY/MM/DD). 
  5. Provide a very short description (max 5 words).
  Output as a JSON object.`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // JSON部分だけを抽出してパース
    const jsonMatch = text.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error("No JSON found in response");
    
    return JSON.parse(jsonMatch[0]) as AnalysisResult;
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
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const prompt = `この写真は緯度: ${lat}, 経度: ${lng} の地点に配置されました。
  画像の内容とこの座標情報から、ここがどこであるかを特定し、具体的な場所名を日本語で返してください。
  余計な説明は省き、場所の名前のみを返してください。`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      }
    ]);
    const response = await result.response;
    return response.text().trim() || "特定された地点";
  } catch (error) {
    console.error("AI Location Identification Error:", error);
    return "特定できませんでした";
  }
};




