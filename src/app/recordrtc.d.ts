declare module 'recordrtc' {
  export interface RecordRTCOptions {
    type?: string;
    mimeType?: string;
    audioBitsPerSecond?: number;
    numberOfAudioChannels?: number;
    sampleRate?: number;
    disableLogs?: boolean;
  }

  export class RecordRTC {
    constructor(stream: MediaStream, options: RecordRTCOptions);
    startRecording(): void;
    stopRecording(callback?: () => void): void;
    pauseRecording(): void;
    resumeRecording(): void;
    destroy(): void;
    getBlob(): Blob;
    getDataURL(callback: (dataURL: string) => void): void;
    toURL(): string;
  }
}