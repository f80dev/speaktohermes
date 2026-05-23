import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatRippleModule } from '@angular/material/core';

import { Subject, takeUntil } from 'rxjs';

import { HermesService, HermesMessage } from './hermes.service';
import { VoiceService, RecordingState } from './voice.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatBadgeModule,
    MatRippleModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  messages: HermesMessage[] = [];
  currentText = '';
  recordingState: RecordingState = 'idle';
  isLoading = false;
  error = '';
  healthStatus: { hermes: any; stt: any } | null = null;
  sessionId: string | null = null;
  isSpeaking = false;

  private destroy$ = new Subject<void>();

  constructor(
    public hermesService: HermesService,
    public voiceService: VoiceService
  ) {}

  ngOnInit(): void {
    this.hermesService.conversation$
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => {
        this.messages = history;
        this.scrollToBottom();
      });

    this.voiceService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.recordingState = state;
      });

    this.hermesService.checkHealth()
      .subscribe({
        next: status => this.healthStatus = status,
        error: () => this.error = 'Cannot connect to Hermes or STT server'
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // === Voice Recording ===

  async startRecording(): Promise<void> {
    this.error = '';
    try {
      await this.voiceService.startRecording();
    } catch (e: any) {
      this.error = `Microphone error: ${e.message || e}`;
    }
  }

  async stopAndTranscribe(): Promise<void> {
    try {
      const base64 = await this.voiceService.stopRecording();

      this.hermesService.transcribeAudio(base64)
        .subscribe({
          next: result => {
            if (result.text?.trim()) {
              this.sendToHermes(result.text.trim());
            } else {
              this.error = 'No speech detected';
              this.recordingState = 'idle';
            }
          },
          error: (err: any) => {
            this.error = `Transcription failed: ${err.message || err}`;
            this.recordingState = 'idle';
          }
        });
    } catch (e: any) {
      this.error = `Recording error: ${e.message || e}`;
      this.recordingState = 'idle';
    }
  }

  cancelRecording(): void {
    this.voiceService.cancelRecording();
    this.error = '';
  }

  // === Hermes ===

  sendToHermes(text: string): void {
    if (!text.trim()) return;
    this.isLoading = true;
    this.error = '';
    this.recordingState = 'idle';

    this.hermesService.sendMessage(text.trim())
      .subscribe({
        next: response => {
          this.isLoading = false;
          if (response.sessionId) {
            this.sessionId = response.sessionId;
          }
        },
        error: (err: any) => {
          this.isLoading = false;
          this.error = `Hermes error: ${err.message || err}`;
        }
      });
  }

  onKeySubmit(): void {
    if (this.currentText.trim()) {
      this.sendToHermes(this.currentText);
      this.currentText = '';
    }
  }

  startNewSession(): void {
    this.hermesService.startNewSession();
    this.sessionId = null;
    this.error = '';
    this.messages = [];
  }

  // === Text-to-Speech ===

  speakText(text: string): void {
    if (this.isSpeaking) {
      speechSynthesis.cancel();
      this.isSpeaking = false;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.1;

    utterance.onend = () => this.isSpeaking = false;
    utterance.onerror = () => this.isSpeaking = false;

    this.isSpeaking = true;
    speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    speechSynthesis.cancel();
    this.isSpeaking = false;
  }

  // === UI Helpers ===

  trackByIndex(index: number): number { return index; }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = document.querySelector('.messages-scroll');
      if (container) container.scrollTop = container.scrollHeight;
    }, 50);
  }

  get recording() { return this.recordingState === 'recording'; }
  get processing() { return this.recordingState === 'processing'; }
  get idle() { return this.recordingState === 'idle'; }

  get hermesHealthy() { return this.healthStatus?.hermes?.status === 'ok'; }
  get sttHealthy() { return this.healthStatus?.stt?.status === 'ok'; }
}