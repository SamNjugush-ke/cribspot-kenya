// frontend/src/app/ads.txt/route.ts
export async function GET() {
  return new Response(
    "google.com, pub-6820149438274131, DIRECT, f08c47fec0942fa0",
    {
      headers: {
        "Content-Type": "text/plain",
      },
    }
  );
}