
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const getFavLeadsEndpoint = `${process.env.BASE_URL}/get_fav_lead`;

  if (!process.env.BASE_URL) {
    return NextResponse.json(
      { error: 'Backend API endpoint is not configured.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    if (!body.email || !body.password) {
        return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const response = await fetch(getFavLeadsEndpoint, {
      method: 'POST',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
       let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.message || errorJson.error || errorText;
      } catch (e) { /* Not a JSON response */ }

      console.error(`Error from external get_fav_lead API:`, errorDetails);
      return NextResponse.json(
        { error: `Failed to fetch favorite leads. Status: ${response.status}`, details: errorDetails },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error(`Error proxying get_fav_lead request:`, error);
    return NextResponse.json(
      { error: 'Failed to proxy request to the backend API.' },
      { status: 500 }
    );
  }
}
