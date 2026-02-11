// === Feedback Copilot — Panel Client ===

class ReviewPanel {
  constructor() {
    this.ws = null;
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isRecording = false;
    this.isDrawMode = false;
    this.reviewLog = [];

    // Detect overlay mode
    this.isOverlay = new URLSearchParams(window.location.search).get('overlay') === 'true';

    // DOM
    this.els = {
      status: document.getElementById('session-status'),
      progress: document.getElementById('progress-text'),
      progressBar: document.getElementById('progress-bar'),
      message: document.getElementById('claude-message'),
      transcript: document.getElementById('transcript-preview'),
      talkBtn: document.getElementById('talk-button'),
      logContainer: document.getElementById('review-log'),
      skipBtn: document.getElementById('skip-btn'),
      wrapupBtn: document.getElementById('wrapup-btn'),
      drawBtn: document.getElementById('draw-button'),
      drawStatus: document.getElementById('draw-status'),
      drawDoneBtn: document.getElementById('draw-done-btn'),
      drawClearBtn: document.getElementById('draw-clear-btn'),
    };

    this.init();
  }

  init() {
    if (this.isOverlay) {
      document.body.classList.add('overlay');
      this.setupOverlayMessaging();
    }
    this.connectWebSocket();
    this.setupSpeechRecognition();
    this.setupControls();
    this.renderEmptyLog();
  }


  // --- WebSocket ---

  connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${protocol}://${location.host}`);

    this.ws.onopen = () => {
      this.els.status.textContent = 'Connected';
      this.els.status.className = 'status-badge active';
    };

    this.ws.onclose = () => {
      this.els.status.textContent = 'Disconnected';
      this.els.status.className = 'status-badge';
      // Attempt reconnect
      setTimeout(() => this.connectWebSocket(), 2000);
    };

    this.ws.onmessage = (msg) => {
      const { event, data } = JSON.parse(msg.data);
      this.handleEvent(event, data);
    };
  }

  send(event, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  handleEvent(event, data) {
    switch (event) {
      case 'init':
        this.onSessionInit(data);
        break;
      case 'speak':
        this.onSpeak(data);
        break;
      case 'listen_start':
        this.activateMic();
        break;
      case 'log_update':
        this.onLogUpdate(data);
        break;
      case 'state_update':
        this.onStateUpdate(data);
        break;
      case 'session_end':
        this.onSessionEnd(data);
        break;
      case 'request_drawing':
        this.onRequestDrawing(data);
        break;
      case 'hide_overlay':
        this.forwardToHost('fc-hide-overlay');
        break;
      case 'show_overlay':
        this.forwardToHost('fc-show-overlay');
        break;
    }
  }


  // --- Overlay Messaging ---

  setupOverlayMessaging() {
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'fc-drawing-complete') {
        this.onDrawingComplete(e.data.imageData);
      }
    });
  }

  forwardToHost(messageType) {
    if (this.isOverlay && window.parent !== window) {
      window.parent.postMessage({ type: messageType }, '*');
    }
  }


  // --- Speech Recognition ---

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.els.message.textContent = 'Speech recognition requires Chrome or Edge. Please open this page in one of those browsers.';
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      // Show live transcript
      const display = final || interim;
      if (display) {
        this.els.transcript.textContent = display;
        this.els.transcript.classList.add('visible');
      }

      this.currentTranscript = (this.currentTranscript || '') + final;
    };

    this.recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
      }
    };

    this.recognition.onend = () => {
      // If still supposed to be recording, restart (browser stops after silence)
      if (this.isRecording) {
        this.recognition.start();
      }
    };
  }


  // --- Controls ---

  setupControls() {
    const btn = this.els.talkBtn;

    // Support both hold-to-talk and click-to-toggle
    let holdTimer = null;
    let isHolding = false;

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isHolding = true;
      holdTimer = setTimeout(() => {
        // Held long enough — this is hold-to-talk mode
        this.startRecording();
      }, 200);
    });

    btn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (holdTimer) clearTimeout(holdTimer);

      if (isHolding && this.isRecording) {
        // Was holding — release to stop
        this.stopRecording();
      } else if (!this.isRecording) {
        // Quick click — toggle on
        this.startRecording();
      } else {
        // Click while recording — toggle off
        this.stopRecording();
      }
      isHolding = false;
    });

    btn.addEventListener('mouseleave', () => {
      if (isHolding && this.isRecording) {
        this.stopRecording();
      }
      isHolding = false;
      if (holdTimer) clearTimeout(holdTimer);
    });

    // Keyboard: spacebar to toggle
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (!btn.disabled) {
          if (this.isRecording) this.stopRecording();
          else this.startRecording();
        }
      }
    });

    // Footer buttons
    this.els.skipBtn.addEventListener('click', () => {
      this.send('user_speech', '[[NEXT PAGE]]');
    });

    this.els.wrapupBtn.addEventListener('click', () => {
      this.send('user_speech', '[[WRAP UP]]');
    });

    // Draw buttons
    if (this.els.drawBtn) {
      this.els.drawBtn.addEventListener('click', () => {
        if (this.isDrawMode) {
          this.stopDrawMode();
        } else {
          this.startDrawMode();
        }
      });
    }

    if (this.els.drawDoneBtn) {
      this.els.drawDoneBtn.addEventListener('click', () => {
        this.stopDrawMode();
      });
    }

    if (this.els.drawClearBtn) {
      this.els.drawClearBtn.addEventListener('click', () => {
        this.clearDrawing();
      });
    }
  }

  startRecording() {
    if (!this.recognition || this.isRecording) return;
    this.isRecording = true;
    this.currentTranscript = '';
    this.els.transcript.textContent = '';
    this.els.transcript.classList.remove('visible');
    this.els.talkBtn.classList.add('recording');
    this.els.talkBtn.querySelector('.talk-btn-label').textContent = 'Listening...';
    this.els.status.textContent = 'Listening';
    this.els.status.className = 'status-badge listening';

    // Stop any ongoing TTS
    this.synthesis.cancel();

    this.recognition.start();
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.recognition.stop();
    this.els.talkBtn.classList.remove('recording');
    this.els.talkBtn.querySelector('.talk-btn-label').textContent = 'Hold to Talk';
    this.els.talkBtn.disabled = true;
    this.els.status.textContent = 'Thinking...';
    this.els.status.className = 'status-badge';

    // Send whatever we captured
    const transcript = (this.currentTranscript || '').trim();
    if (transcript) {
      this.send('user_speech', transcript);
    } else {
      // Nothing captured, re-enable
      this.els.talkBtn.disabled = false;
    }

    // Clear transcript preview after a beat
    setTimeout(() => {
      this.els.transcript.classList.remove('visible');
    }, 500);
  }

  activateMic() {
    this.els.talkBtn.disabled = false;
    this.els.status.textContent = 'Your turn';
    this.els.status.className = 'status-badge active';
  }


  // --- Draw Mode ---

  startDrawMode() {
    this.isDrawMode = true;
    if (this.els.drawBtn) this.els.drawBtn.classList.add('active');
    if (this.els.drawStatus) this.els.drawStatus.style.display = 'flex';

    if (this.isOverlay) {
      this.forwardToHost('fc-start-drawing');
    }
  }

  stopDrawMode() {
    if (this.isOverlay) {
      this.forwardToHost('fc-stop-drawing');
    }
    // UI reset happens when we receive the drawing back (onDrawingComplete)
    // But if not in overlay mode, reset immediately
    if (!this.isOverlay) {
      this.resetDrawUI();
    }
  }

  clearDrawing() {
    if (this.isOverlay) {
      this.forwardToHost('fc-clear-drawing');
    }
  }

  onDrawingComplete(imageData) {
    // Send the image through WebSocket to the MCP server
    this.send('drawing_complete', imageData);
    this.resetDrawUI();
  }

  onRequestDrawing(data) {
    // Claude is asking the user to draw
    if (data.message) {
      this.els.message.textContent = data.message;
    }
    this.startDrawMode();
  }

  resetDrawUI() {
    this.isDrawMode = false;
    if (this.els.drawBtn) this.els.drawBtn.classList.remove('active');
    if (this.els.drawStatus) this.els.drawStatus.style.display = 'none';
  }


  // --- TTS ---

  speak(text) {
    return new Promise((resolve) => {
      this.synthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Try to pick a good voice
      const voices = this.synthesis.getVoices();
      const preferred = voices.find(
        (v) => v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Microsoft Zira')
      );
      if (preferred) utterance.voice = preferred;

      utterance.onend = resolve;
      utterance.onerror = resolve;
      this.synthesis.speak(utterance);
    });
  }


  // --- Event Handlers ---

  onSessionInit(data) {
    this.pages = data.pages || [];
    this.els.skipBtn.disabled = false;
    this.els.wrapupBtn.disabled = false;
    if (this.els.drawBtn) this.els.drawBtn.disabled = false;
    this.updateProgress(1, this.pages.length);
  }

  async onSpeak(data) {
    this.els.message.textContent = data.message;
    this.els.status.textContent = 'Claude is speaking';
    this.els.status.className = 'status-badge';

    await this.speak(data.message);

    // After speaking, enable mic
    this.send('speech_complete', {});
    this.activateMic();
  }

  onLogUpdate(data) {
    this.reviewLog = data.log;
    this.renderLog();
  }

  onStateUpdate(data) {
    if (data.current_page) {
      // Could highlight current page in the log
    }
    if (data.progress) {
      this.updateProgress(data.progress.current, data.progress.total);
    }
    if (data.status) {
      const labels = {
        reviewing: 'Reviewing',
        listening: 'Your turn',
        thinking: 'Thinking...',
        fixing: 'Fixing issues...',
      };
      this.els.status.textContent = labels[data.status] || data.status;
    }
  }

  onSessionEnd(data) {
    this.els.message.textContent = 'Review complete. Claude is now fixing the issues.';
    this.els.talkBtn.disabled = true;
    this.els.skipBtn.disabled = true;
    this.els.wrapupBtn.disabled = true;
    if (this.els.drawBtn) this.els.drawBtn.disabled = true;
    this.els.status.textContent = 'Complete';
    this.els.status.className = 'status-badge active';
    this.speak('Review complete. I\'m heading back to fix everything now.');
  }


  // --- Rendering ---

  updateProgress(current, total) {
    this.els.progress.textContent = `${current} / ${total}`;
    this.els.progressBar.style.width = `${(current / total) * 100}%`;
  }

  renderEmptyLog() {
    this.els.logContainer.innerHTML = '<div class="log-empty">Feedback will appear here as you review</div>';
  }

  renderLog() {
    if (this.reviewLog.length === 0) {
      this.renderEmptyLog();
      return;
    }

    // Group by page
    const groups = {};
    for (const item of this.reviewLog) {
      if (!groups[item.page]) groups[item.page] = [];
      groups[item.page].push(item);
    }

    this.els.logContainer.innerHTML = Object.entries(groups)
      .map(
        ([page, items]) => `
        <div class="log-page-group">
          <div class="log-page-header">
            <span>${this.escapeHtml(page)}</span>
            <span class="log-page-count">${items.length} item${items.length > 1 ? 's' : ''}</span>
          </div>
          ${items
            .map(
              (item) => `
            <div class="log-item">
              <div class="severity-dot ${item.severity}"></div>
              <span class="log-badge ${item.category}">${item.category.replace('_', ' ')}</span>
              <span>${this.escapeHtml(item.description)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
      )
      .join('');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Boot when voices are ready (Chrome loads them async)
if (speechSynthesis.getVoices().length) {
  new ReviewPanel();
} else {
  speechSynthesis.onvoiceschanged = () => new ReviewPanel();
}
