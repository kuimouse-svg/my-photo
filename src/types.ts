
export interface PhotoMetadata {
  id: string;
  url: string; // セッション中のみ有効なURL
  fileBlob?: Blob; // IndexedDBに保存するバイナリデータ
  name: string;
  locationName: string;
  country?: string;
  latitude: number;
  longitude: number;
  date: string;
  description: string;
  isProcessing: boolean;
  manuallyPlaced?: boolean;
}

export interface AnalysisResult {
  locationName: string;
  country?: string;
  latitude: number;
  longitude: number;
  date: string; // YYYY/MM/DD format
  description: string;
}
