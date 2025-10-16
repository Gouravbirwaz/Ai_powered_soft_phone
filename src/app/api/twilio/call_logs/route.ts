
import { NextRequest, NextResponse } from 'next/server';

// Handle GET requests to fetch call logs
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agent_id');

  // FIX: Correctly point to the versioned backend API endpoint
  let getCallLogsEndpoint = `${process.env.BASE_URL}/api/v1/call_logs`;
  
  if (agentId) {
    getCallLogsEndpoint += `?agent_id=${agentId}`;
  }

  if (!process.env.BASE_URL) {
    return NextResponse.json(
      { error: 'Call logs endpoint is not configured in environment variables.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(getCallLogsEndpoint, {
      method: 'GET', // Explicitly set GET method
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
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
    // FIX: Correctly point to the versioned backend API endpoint
    const postCallLogEndpoint = `${process.env.BASE_URL}/api/v1/call_logs`;
  
    if (!process.env.BASE_URL) {
      return NextResponse.json(
        { error: 'Call logs endpoint is not configured.' },
        { status: 500 }
      );
    }
  
    try {
      const body = await req.json();
      
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
        console.error('Error from call_logs endpoint:', errorText);
        return NextResponse.json({ error: `Failed to add or update call log. Status: ${response.status} ${response.statusText}`, details: errorText }, { status: response.status });
      }
  
      const data = await response.json();
      return NextResponse.json(data);
      
    } catch (error) {
      console.error('Error proxying call_logs request:', error);
      return NextResponse.json(
        { error: 'Failed to proxy call_logs request' },
        { status: 500 }
      );
    }
  }
