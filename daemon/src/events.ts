import type { ServerResponse } from "node:http";

/**
 * Server-sent events bus. The shell keeps one EventSource open and everything
 * that changes (window list, volume, install progress, agent output) arrives here.
 */
class EventBus {
  private clients = new Set<ServerResponse>();

  attach(res: ServerResponse) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`retry: 2000\n\n`);
    this.clients.add(res);
    const ping = setInterval(() => res.write(`: ping\n\n`), 25000);
    res.on("close", () => {
      clearInterval(ping);
      this.clients.delete(res);
    });
  }

  emit(type: string, data: unknown) {
    const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) c.write(frame);
  }

  get size() {
    return this.clients.size;
  }
}

export const bus = new EventBus();
