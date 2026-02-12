// Feedback Copilot — Panel Client
// Runs inside the panel iframe (or standalone tab).

class ReviewPanel {
  constructor() {
    this.ws = null;
    this.isRecording = false;
    this.recognition = null;
    this.isOverlay = new URLSearchParams(window.location.search).has('overlay');
    this.drawMode = false;

    if (this.isOverlay) {
      document.body.classList.add('overlay');
    }

    this.initElements();
    this.initWebSocket();
    this.initSpeechRecognition();
    this.initEventListeners();

    if (this.isOverlay) {
      this.setupOverlayMessaging();
    }
  }

  initElements() {
    this.statusBadge = document.getElementById('status-badge');
    this.progress = document.getElementById('progress');
    this.messageBubble = document.getElementById('message-bubble');
    this.talkBtn = document.getElementById('talk-btn');
    this.drawBtn = document.getElementById('draw-btn');
    this.drawStatus = document.getElementById('draw-status');
    this.drawDoneBtn = document.getElementById('draw-done-btn');
    this.drawClearBtn = document.getElementById('draw-clear-btn');
    this.reviewLog = document.getElementById('review-log');
    this.nextPageBtn = document.getElementById('next-page-btn');
    this.wrapUpBtn = document.getElementById('wrap-up-btn');
  }

  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.setStatus('Connected', true);
    };

    this.ws.onclose = () => {
      this.setStatus('Disconnected', false);
      // Auto-reconnect after 2 seconds
      setTimeout(() => this.initWebSocket(), 2000);
    };

    this.ws.onerror = () => {
      this.setStatus('Error', false);
    };

    this.ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        this.handleEvent(msg.event, msg.data);
      } catch (e) {
        // Ignore malformed messages
      }
    };
  }

  handleEvent(event, data) {
    switch (event) {
      case 'init':
        this.messageBubble.textContent = 'Session started. Waiting for review to begin...';
        break;

      case 'speak':
        this.speakText(data.message);
        break;

      case 'listen_start':
        this.startRecording();
        break;

      case 'log_update':
        this.renderLog(data.log);
        break;

      case 'state_update':
        if (data.current_page) {
          this.progress.textContent = data.progress || data.current_page;
        }
        if (data.status) {
          this.setStatus(data.status, true);
        }
        break;

      case 'session_end':
        this.messageBubble.textContent = 'Review session ended. Check the summary above.';
        this.setStatus('Ended', false);
        break;

      case 'request_drawing':
        this.onRequestDrawing(data);
        break;

      case 'hide_overlay':
        if (this.isOverlay) {
          this.forwardToHost('fc-hide-overlay');
        }
        break;

      case 'show_overlay':
        if (this.isOverlay) {
          this.forwardToHost('fc-show-overlay');
        }
        break;
    }
  }

  setStatus(text, connected) {
    this.statusBadge.textContent = text;
    this.statusBadge.className = 'status-badge' + (connected ? ' connected' : '');
  }

  // ===== Speech Synthesis =====

  speakText(text) {
    this.messageBubble.textContent = text;

    if (!window.speechSynthesis) {
      // No TTS support — just display text and send completion
      this.sendEvent('speech_complete', {});
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = ['Samantha', 'Google UK English Female', 'Microsoft Zira', 'Karen', 'Moira'];
    for (const name of preferred) {
      const voice = voices.find((v) => v.name.includes(name));
      if (voice) {
        utterance.voice = voice;
        break;
      }
    }

    utterance.onend = () => {
      this.sendEvent('speech_complete', {});
    };

    utterance.onerror = () => {
      this.sendEvent('speech_complete', {});
    };

    window.speechSynthesis.speak(utterance);
  }

  // ===== Speech Recognition =====

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    let finalTranscript = '';

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      // Show interim results in the message bubble
      this.messageBubble.textContent = finalTranscript + interim;
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        // Was still recording — send what we have
        this.isRecording = false;
        this.talkBtn.classList.remove('recording');

        const text = finalTranscript.trim();
        if (text) {
          this.sendEvent('user_speech', text);
        }
        finalTranscript = '';
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.isRecording = false;
        this.talkBtn.classList.remove('recording');
      }
    };
  }

  startRecording() {
    if (!this.recognition || this.isRecording) return;
    this.isRecording = true;
    this.talkBtn.classList.add('recording');
    this.messageBubble.textContent = 'Listening...';
    try {
      this.recognition.start();
    } catch (e) {
      // Already started
    }
  }

  stopRecording() {
    if (!this.recognition || !this.isRecording) return;
    this.isRecording = false;
    this.talkBtn.classList.remove('recording');
    try {
      this.recognition.stop();
    } catch (e) {
      // Already stopped
    }
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  // ===== Drawing =====

  onRequestDrawing(data) {
    if (data && data.message) {
      this.messageBubble.textContent = data.message;
    }
    this.startDrawMode();
  }

  startDrawMode() {
    this.drawMode = true;
    this.drawBtn.classList.add('active');
    this.drawStatus.classList.add('visible');

    if (this.isOverlay) {
      this.forwardToHost('fc-start-drawing');
    }
  }

  stopDrawMode() {
    this.drawMode = false;
    this.drawBtn.classList.remove('active');
    this.drawStatus.classList.remove('visible');

    if (this.isOverlay) {
      this.forwardToHost('fc-stop-drawing');
    }
  }

  clearDrawing() {
    if (this.isOverlay) {
      this.forwardToHost('fc-clear-drawing');
    }
  }

  onDrawingComplete(imageData) {
    this.drawMode = false;
    this.drawBtn.classList.remove('active');
    this.drawStatus.classList.remove('visible');
    this.messageBubble.textContent = 'Drawing received.';
    this.sendEvent('drawing_complete', imageData);
  }

  // ===== Overlay Messaging =====

  setupOverlayMessaging() {
    window.addEventListener('message', (e) => {
      if (!e.data || !e.data.type) return;

      if (e.data.type === 'fc-drawing-complete') {
        this.onDrawingComplete(e.data.imageData);
      }
    });
  }

  forwardToHost(type) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type }, '*');
    }
  }

  // ===== Event Listeners =====

  initEventListeners() {
    // Talk button click
    this.talkBtn.addEventListener('click', () => this.toggleRecording());

    // Spacebar toggle
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && e.target === document.body) {
        e.preventDefault();
        this.toggleRecording();
      }
    });

    // Draw button
    this.drawBtn.addEventListener('click', () => {
      if (this.drawMode) {
        this.stopDrawMode();
      } else {
        this.startDrawMode();
      }
    });

    // Draw done/clear buttons
    this.drawDoneBtn.addEventListener('click', () => this.stopDrawMode());
    this.drawClearBtn.addEventListener('click', () => this.clearDrawing());

    // Footer buttons
    this.nextPageBtn.addEventListener('click', () => {
      this.sendEvent('user_speech', '[[NEXT PAGE]]');
    });

    this.wrapUpBtn.addEventListener('click', () => {
      this.sendEvent('user_speech', '[[WRAP UP]]');
    });
  }

  // ===== Helpers =====

  sendEvent(event, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderLog(items) {
    if (!items || items.length === 0) {
      this.reviewLog.innerHTML = '';
      return;
    }

    let html = '';
    for (const item of items) {
      html += `<div class="log-item">
        <div class="log-item-header">
          <span class="severity-dot ${this.escapeHtml(item.severity)}"></span>
          <span class="log-badge ${this.escapeHtml(item.category)}">${this.escapeHtml(item.category)}</span>
          <span style="font-size:11px;color:var(--text-secondary)">${this.escapeHtml(item.page)}</span>
        </div>
        <div class="log-item-desc">${this.escapeHtml(item.description)}</div>
      </div>`;
    }
    this.reviewLog.innerHTML = html;
    this.reviewLog.scrollTop = this.reviewLog.scrollHeight;
  }
}

// Wait for voices to load, then initialize
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    new ReviewPanel();
  };
  // Fallback if onvoiceschanged doesn't fire
  setTimeout(() => {
    if (!document.querySelector('.status-badge.connected')) {
      new ReviewPanel();
    }
  }, 1000);
} else {
  new ReviewPanel();
}
