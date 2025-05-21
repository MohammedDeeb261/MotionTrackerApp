// This is a minimal mock for the ws package
// It provides dummy implementations of WebSocketServer and related functionality

class WebSocket {
  constructor() {
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
  }

  on() { return this; }
  addEventListener() { return this; }
  removeEventListener() { return this; }
  send() { return true; }
  close() { return true; }
  ping() { return true; }
  pong() { return true; }
  terminate() { return true; }
}

class WebSocketServer {
  constructor() {
    this.clients = new Set();
  }

  on() { return this; }
  close() { return true; }
  handleUpgrade() { return true; }
  shouldHandle() { return false; }
}

// Export WebSocket and WebSocketServer
module.exports = WebSocket;
module.exports.WebSocket = WebSocket;
module.exports.WebSocketServer = WebSocketServer;
module.exports.createWebSocketStream = () => ({});
module.exports.Server = WebSocketServer;
