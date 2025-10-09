
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const makeCallEndpoint = `${process.env.BASE_URL}/api/twilio/make_call`;

  if (!process.env.BASE_URL) {
    return NextResponse.json(
      { error: 'Twilio make_call endpoint is not configured in environment variables.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    
    // Ensure agent_id and to are in the body being forwarded
    if (!body.agent_id || !body.to) {
        return NextResponse.json({ error: "Missing 'agent_id' or 'to' in request body" }, { status: 400 });
    }
    
    const response = await fetch(makeCallEndpoint, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from make_call endpoint:', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        return NextResponse.json({ error: errorJson.description || `Failed to initiate call from backend.` }, { status: response.status });
      } catch (e) {
        return NextResponse.json({ error: `Failed to initiate call from backend. Status: ${response.status}` }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error proxying make_call request:', error);
    return NextResponse.json({ error: 'Failed to proxy make_call request' }, { status: 500 });
  }
}
