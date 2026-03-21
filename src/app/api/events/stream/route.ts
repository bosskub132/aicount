export const runtime = "nodejs";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      controller.enqueue(encoder.encode("event: connected\ndata: {\"ok\":true}\n\n"));

      const interval = setInterval(() => {
        controller.enqueue(
          encoder.encode(`event: heartbeat\ndata: {"timestamp":"${new Date().toISOString()}"}\n\n`)
        );
      }, 15000);

      return () => clearInterval(interval);
    },
    cancel() {
      // no-op
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

