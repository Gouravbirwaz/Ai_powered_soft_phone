
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const identity = searchParams.get('identity');
  
  if (!identity) {
    return NextResponse.json({ error: 'Identity is required' }, { status: 400 });
  }

  const tokenEndpoint = `${process.env.NEXT_PUBLIC_BASE_URL}/token`;

  try {
    const response = await fetch(tokenEndpoint, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from token endpoint:', errorText);
      return NextResponse.json({ error: 'Failed to fetch token from backend' }, { status: response.status });
    }

    const data = await response.json();
    // The backend provides the token directly, just proxy it.
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error proxying token request:', error);
    return NextResponse.json({ error: 'Failed to proxy token request' }, { status: 500 });
  }
}
