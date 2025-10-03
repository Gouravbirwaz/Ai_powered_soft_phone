
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const agentsEndpoint = `${process.env.BASE_URL}/api/v1/agents`;

  if (!process.env.BASE_URL) {
    return NextResponse.json(
      { error: 'Agents API endpoint is not configured.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(agentsEndpoint, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from external agents API:', errorText);
      return NextResponse.json(
        { error: `Failed to fetch from external API. Status: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error proxying request to agents API:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request to the agents API.' },
      { status: 500 }
    );
  }
}
