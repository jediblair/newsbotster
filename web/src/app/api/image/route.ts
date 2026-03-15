import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/avif',
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');

  if (!raw) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  // Only allow http(s) URLs — block SSRF via file://, data:, etc.
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse('Invalid URL', { status: 400 });
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return new NextResponse('URL scheme not allowed', { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsAggregator/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: 204 });
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    const mimeBase = contentType.split(';')[0].trim().toLowerCase();

    if (!ALLOWED_CONTENT_TYPES.has(mimeBase)) {
      return new NextResponse(null, { status: 204 });
    }

    const buffer = await upstream.arrayBuffer();

    if (buffer.byteLength > MAX_SIZE_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeBase,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[image proxy] fetch error:', err);
    return new NextResponse(null, { status: 204 });
  }
}
