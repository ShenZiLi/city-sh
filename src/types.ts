export type TimeOfDay = "day" | "dusk" | "night";
export type ViewName = "overview" | "lujiazui" | "bund" | "river";
export type Quality = "high" | "low";
export interface LandmarkDefinition {
  id: string;
  name: string;
  en: string;
  description: string;
  position: [number, number, number];
  height: number;
  kind: string;
  width: number;
  depth: number;
}
export interface SceneControls {
  setTime(time: TimeOfDay): void;
  setView(view: ViewName): void;
  setAutoRotate(value: boolean): void;
  setLabels(value: boolean): void;
  setQuality(value: Quality): void;
  focusLandmark(id: string): void;
  reset(): void;
  capture(): Promise<Blob>;
  dispose(): void;
}
export interface SceneEvents {
  onReady(): void;
  onProgress(progress: number): void;
  onSelect(landmark: LandmarkDefinition | null): void;
  onAutoRotate(value: boolean): void;
  onError(message: string): void;
  onStats(fps: number): void;
}
