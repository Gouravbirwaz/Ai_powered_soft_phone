
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Use the server-side environment variable BASE_URL
  const makeCallEndpoint = `${process.env.BASE_URL}/api/twilio/make_call`;

  if (!process.env.BASE_URL) {
    return NextResponse.json(
      { error: 'Twilio make_call endpoint is not configured in environment variables.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    
    const response = await fetch(makeCallEndpoint, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body), // Forward the original body
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from make_call endpoint:', errorText);
      // Proxy the error response from the backend
      return NextResponse.json({ error: `Failed to initiate call from backend. Status: ${response.status} ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error proxying make_call request:', error);
    return NextResponse.json({ error: 'Failed to proxy make_call request' }, { status: 500 });
  }
}
