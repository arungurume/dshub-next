export interface PlaylistItem {
  id: string | number;
  name: string;
  thumbLink?: string;
  duration: number;          // seconds
  contentType?: string;
  assetSourceType?: string;
  permaLink?: string;
  metadata?: any;
}

export interface TransitionSettings {
  type: 'NONE' | 'SLIDE' | 'FADE' | 'ZOOM' | 'ROTATE' | 'FLIP';
  speed: 'SLOW' | 'MEDIUM' | 'FAST';
}

export interface ContentAsset {
  id: string | number;
  name: string;
  thumbLink?: string;
  contentType?: string;
  duration?: number;
  permaLink?: string;
}
