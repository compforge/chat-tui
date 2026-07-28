export type SidecarItemTone =
  | "default"
  | "muted"
  | "success"
  | "warning"
  | "error";

export interface SidecarItem {
  id: string;
  title: string;
  status?: string;
  detail?: string;
  tone?: SidecarItemTone;
}

export interface SidecarSection {
  id: string;
  title?: string;
  items: SidecarItem[];
}

export interface SidecarState {
  title?: string;
  sections: SidecarSection[];
  mode?: "auto" | "open" | "hidden";
}
