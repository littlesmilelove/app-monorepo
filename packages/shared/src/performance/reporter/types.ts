/**
 * Performance monitoring types
 */

export interface PerfEvent {
  sessionId: string;
  timestamp: number; // Relative to session start (ms)
  absoluteTime: number; // Date.now()
  platform: 'web' | 'desktop' | 'ext' | 'ios' | 'android';
  type:
    | 'module_load'
    | 'function_call'
    | 'memory'
    | 'fps'
    | 'long_task'
    | 'mark';
  data:
    | ModuleLoadData
    | FunctionCallData
    | MemoryData
    | FPSData
    | LongTaskData
    | MarkData;
}

export interface ModuleLoadData {
  path: string;
  duration: number;
}

export interface FunctionCallData {
  name: string;
  file: string;
  line?: number;
  duration: number;
  module?: string;
  stack?: string[];
}

export interface MemoryData {
  heapUsed?: number;
  heapTotal?: number;
  external?: number;
  rss?: number;
}

export interface FPSData {
  fps: number;
  dropped?: number;
}

export interface LongTaskData {
  duration: number;
  attribution?: string;
}

export interface MarkData {
  name: string;
  detail?: any;
}

export interface PerfReporterOptions {
  serverUrl: string;
  timeout: number;
  platform?: 'web' | 'desktop' | 'ext' | 'ios' | 'android';
}

export interface PerfReporterInstance {
  send: (type: PerfEvent['type'], data: PerfEvent['data']) => void;
  isConnected: () => boolean;
  close: () => void;
}
