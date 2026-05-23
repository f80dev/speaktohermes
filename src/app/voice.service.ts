import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';

declare var RecordRTC: any;

export type RecordingState = 'idle' | 'recording' | 'processing';

@Injectable({ providedIn: 'root' })
export class VoiceService {
  private recorder: any = null;
  private stream: MediaStream | null = null;

  private stateSubject = new Subject<RecordingState>();
  state$ = this.stateSubject.asObservable();

  constructor(private zone: NgZone) {}

  /**
   * Start recording from microphone
   */
  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      });

      const RecordRTCModule = await import('recordrtc');
      const RecordRTC = RecordRTCModule.RecordRTC;

      this.recorder = new RecordRTC(this.stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000,
        numberOfAudioChannels: 1,
        sampleRate: 16000,
        disableLogs: true
      });

      this.recorder.startRecording();
      this.zone.run(() => this.stateSubject.next('recording'));
    } catch (err) {
      console.error('Failed to start recording:', err);
      throw err;
    }
  }

  /**
   * Stop recording and return base64 audio
   */
  stopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.recorder.stopRecording(() => {
        const audioBlob = this.recorder.getBlob();

        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          this.zone.run(() => this.stateSubject.next('processing'));
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Stop all tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
    });
  }

  /**
   * Cancel recording without getting audio
   */
  cancelRecording(): void {
    if (this.recorder) {
      try {
        this.recorder.destroy();
      } catch {}
      this.recorder = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.zone.run(() => this.stateSubject.next('idle'));
  }

  /**
   * Check if microphone is available
   */
  async checkMicrophone(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(d => d.kind === 'audioinput');
    } catch {
      return false;
    }
  }

  /**
   * Get list of available microphones
   */
  async getMicrophones(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audioinput');
    } catch {
      return [];
    }
  }
}