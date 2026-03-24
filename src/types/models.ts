export interface ModelInfo {
  id: string;
  key?: string | null;
  mode?: 'chat' | 'completion' | 'embedding' | 'responses' | null;
  supports_system_messages?: boolean | null;
  supports_vision?: boolean | null;
  supports_function_calling?: boolean | null;
  supports_tool_choice?: boolean | null;
  supports_native_streaming?: boolean | null;
  [key: string]: unknown;
}

export interface ModelEntry {
  model_name: string;
  model_info: ModelInfo;
}

export interface ModelInfoResponse {
  data: ModelEntry[];
}
