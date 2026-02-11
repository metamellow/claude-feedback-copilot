class ConnectionManager {
  constructor() {
    this.ws = null;
    this.pendingResolvers = new Map();
  }

  register(ws) {
    this.ws = ws;

    ws.on('message', (raw) => {
      try {
        const { event, data } = JSON.parse(raw);
        const resolver = this.pendingResolvers.get(event);
        if (resolver) {
          this.pendingResolvers.delete(event);
          resolver(data);
        }
      } catch (err) {
        console.error('WS message parse error:', err);
      }
    });

    ws.on('close', () => {
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
        reject(new Error(`Timeout waiting for ${eventName}`));
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
    if (this.ws) this.ws.close();
    this.pendingResolvers.clear();
  }
}

module.exports = { ConnectionManager };
