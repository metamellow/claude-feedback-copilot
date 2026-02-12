class ConnectionManager {
  constructor() {
    this.ws = null;
    this.pendingResolvers = new Map();
  }

  register(ws) {
    this.ws = ws;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        const { event, data } = msg;
        if (event && this.pendingResolvers.has(event)) {
          const resolve = this.pendingResolvers.get(event);
          this.pendingResolvers.delete(event);
          resolve(data);
        }
      } catch (e) {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      this.ws = null;
    });

    ws.on('error', () => {
      this.ws = null;
    });
  }

  send(payload) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  waitForEvent(eventName, timeout = 120000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResolvers.delete(eventName);
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);

      this.pendingResolvers.set(eventName, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  isConnected() {
    return this.ws && this.ws.readyState === 1;
  }

  close() {
    // Reject all pending resolvers
    for (const [event, resolve] of this.pendingResolvers) {
      // These are actually stored as resolve functions, so we can't reject them
      // Just clear them
    }
    this.pendingResolvers.clear();

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // Ignore
      }
      this.ws = null;
    }
  }
}

module.exports = { ConnectionManager };
