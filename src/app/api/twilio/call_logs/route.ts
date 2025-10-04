
import { NextRequest, NextResponse } from 'next/server';

// Handle GET requests to fetch call logs by transforming them into a POST request for the backend
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agent_id');

  if (!agentId) {
    return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
  }

  // The backend expects a POST request to fetch logs
  const getCallLogsEndpoint = `${process.env.BASE_URL}/api/v1/call_logs`;

  if (!process.env.BASE_URL) {
    return NextResponse.json(
      { error: 'Call logs endpoint is not configured in environment variables.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(getCallLogsEndpoint, {
      method: 'POST', // Backend requires POST to fetch logs
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent_id: agentId }), // Pass agent_id in the body
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from get_call_logs endpoint:', errorText);
      return NextResponse.json({ error: `Failed to fetch call logs. Status: ${response.status} ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error proxying get_call_logs request:', error);
    return NextResponse.json({ error: 'Failed to proxy get_call_logs request' }, { status: 500 });
  }
}

// Handles POST requests to create or update a call log
export async function POST(req: NextRequest) {
    const postCallLogEndpoint = `${process.env.BASE_URL}/api/v1/call_logs`;
  
    if (!process.env.BASE_URL) {
      return NextResponse.json(
        { error: 'Call logs endpoint is not configured.' },
        { status: 500 }
      );
    }
  
    try {
      // Get the entire body from the frontend request
      const body = await req.json();
      
      // Forward the entire body to the backend
      const response = await fetch(postCallLogEndpoint, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error from add_call_log endpoint:', errorText);
        return NextResponse.json({ error: `Failed to add call log. Status: ${response.status} ${response.statusText}`, details: errorText }, { status: response.status });
      }
  
      const data = await response.json();
      return NextResponse.json(data);
      
    } catch (error) {
      console.error('Error proxying add_call_log request:', error);
      return NextResponse.json(
        { error: 'Failed to proxy add_call_log request' },
        { status: 500 }
      );
    }
  }
  
