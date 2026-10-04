class SocketAdapter {
  constructor() {
    this.events = {};
    this.id = null;
    this.ws = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.sendQueue = [];
    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}/ws`;

    console.log("🔌 Connecting to Spring WebSocket:", url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("✅ Spring WebSocket Connected!");
      this.connected = true;

      // Flush any queued messages buffered before connection opened
      while (this.sendQueue.length > 0) {
        const queued = this.sendQueue.shift();
        try {
          this.ws.send(JSON.stringify(queued));
        } catch (e) {
          console.error("Error flushing queued WebSocket message:", e);
        }
      }

      if (this.events["connect"]) {
        this.events["connect"].forEach(cb => cb());
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { event: eventName, data } = msg;

        if (eventName === "_connection_ack") {
          this.id = data.socketId;
          console.log("🔑 Session ID assigned:", this.id);
          return;
        }

        if (this.events[eventName]) {
          this.events[eventName].forEach(cb => cb(data));
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    this.ws.onclose = () => {
      console.warn("⚠️ WebSocket Disconnected!");
      this.connected = false;
      if (this.events["disconnect"]) {
        this.events["disconnect"].forEach(cb => cb());
      }
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 2000);
      }
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
    };
  }

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  emit(eventName, data) {
    const payload = { event: eventName, data: data || {} };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      console.log("WebSocket connecting, queueing emit:", eventName);
      this.sendQueue.push(payload);
    }
  }
}

function io() {
  if (!window._socketInstance) {
    window._socketInstance = new SocketAdapter();
  }
  return window._socketInstance;
}
