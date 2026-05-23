import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, Subject, BehaviorSubject } from 'rxjs';

export interface HermesMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface HermesResponse {
  text: string;
  sessionId?: string;
}

@Injectable({ providedIn: 'root' })
export class HermesService {
  // Use server IP instead of localhost for external access
  private apiUrl = 'http://192.168.3.27:8642/v1';
  private sttUrl = 'http://192.168.3.27:8787';

  // Observable conversation history
  private conversationSubject = new BehaviorSubject<HermesMessage[]>([]);
  conversation$ = this.conversationSubject.asObservable();

  // Session ID for continuity
  private sessionId: string | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Send a text message to Hermes agent
   */
  sendMessage(text: string): Observable<HermesResponse> {
    return new Observable(observer => {
      fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.sessionId ? { 'X-Hermes-Session-Id': this.sessionId } : {})
        },
        body: JSON.stringify({
          model: 'hermes-agent',
          messages: [
            ...this.getSystemPrompt(),
            ...this.conversationSubject.value,
            { role: 'user', content: text }
          ],
          max_tokens: 2048,
          stream: false
        })
      })
      .then(res => res.json())
      .then(data => {
        const textResponse = data.choices?.[0]?.message?.content || '';
        const newSessionId = data.session_id || this.sessionId;

        if (newSessionId && newSessionId !== this.sessionId) {
          this.sessionId = newSessionId;
        }

        // Add to conversation history
        const history = this.conversationSubject.value;
        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: textResponse });
        this.conversationSubject.next(history);

        observer.next({ text: textResponse, sessionId: this.sessionId ?? undefined });
        observer.complete();
      })
      .catch(err => {
        observer.error(err);
      });
    });
  }

  /**
   * Transcribe audio bytes via STT server
   */
  transcribeAudio(audioBase64: string): Observable<{ text: string }> {
    return this.http.post<{ text: string }>(
      `${this.sttUrl}/transcribe`,
      { audio: audioBase64 },
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Start a new Hermes session (clears history)
   */
  startNewSession(): void {
    this.conversationSubject.next([]);
    this.sessionId = null;
  }

  /**
   * Check health of both services
   */
  checkHealth(): Observable<any> {
    return new Observable(observer => {
      Promise.all([
        fetch(`${this.apiUrl}/health`).then(r => r.json()),
        fetch(`${this.sttUrl}/health`).then(r => r.json()).catch(() => ({ status: 'unavailable' }))
      ]).then(([hermes, stt]) => {
        observer.next({ hermes, stt });
        observer.complete();
      }).catch(err => observer.error(err));
    });
  }

  private getSystemPrompt(): HermesMessage[] {
    return [{
      role: 'system',
      content: `Tu es Hermes, un assistant IA puissant fonctionnant via Hermes Agent. Tu peux utiliser tous les outils disponibles pour accomplir les tâches de l'utilisateur. Réponds de manière claire et concise. L'utilisateur communique via une application vocale - sois donc un peu plus direct dans tes réponses.`
    }];
  }

  getHistory(): HermesMessage[] {
    return this.conversationSubject.value;
  }
}