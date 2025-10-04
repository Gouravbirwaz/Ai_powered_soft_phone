
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const callLogsEndpoint = `${process.env.BASE_URL}/api/v1/call_logs`;

  if (!process.env.BASE_URL) {
    return NextResponse.json(
      { error: 'Call logs endpoint is not configured in environment variables.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const response = await fetch(callLogsEndpoint, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from call_logs endpoint:', errorText);
      return NextResponse.json({ error: `Failed to log call. Status: ${response.status} ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Error proxying call_logs request:', error);
    return NextResponse.json({ error: 'Failed to proxy call_logs request' }, { status: 500 });
  }
}
