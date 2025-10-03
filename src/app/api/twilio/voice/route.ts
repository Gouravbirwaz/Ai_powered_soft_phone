import { NextRequest, NextResponse } from 'next/server';
import twilio, { twiml } from 'twilio';
import { NextApiRequest } from 'next';

// IMPORTANT: Disable body parsing for this route to work
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to get raw body from a NextRequest
async function getRawBody(req: NextRequest) {
  const body = req.body;
  if (!body) {
    return '';
  }
  const chunks: Uint8Array[] = [];
  const reader = body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  // This is not strictly a string, but the Twilio validator can handle the buffer
  return Buffer.concat(chunks);
}


export async function POST(req: NextRequest) {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    NEXT_PUBLIC_BASE_URL
  } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !NEXT_PUBLIC_BASE_URL) {
    console.error('Twilio environment variables not configured');
    return new Response('Configuration error', { status: 500 });
  }

  const twilioSignature = req.headers.get('x-twilio-signature');
  const url = `${NEXT_PUBLIC_BASE_URL}${req.nextUrl.pathname}`;
  
  const rawBody = await getRawBody(req);
  const params = new URLSearchParams(rawBody.toString());
  const bodyParams: {[key: string]: string} = {};
  for (const [key, value] of params.entries()) {
    bodyParams[key] = value;
  }

  if (!twilioSignature) {
      return new Response('No signature', { status: 400 });
  }

  const isValid = twilio.validateRequest(
    TWILIO_AUTH_TOKEN,
    twilioSignature,
    url,
    bodyParams
  );

  if (!isValid) {
    return new Response('Invalid signature', { status: 403 });
  }

  const from = bodyParams.From;
  const to = bodyParams.To;

  // Use a consistent conference name for a pair of numbers
  const conferenceName = [from, to].sort().join('-');

  const response = new twiml.VoiceResponse();
  const dial = response.dial();
  dial.conference(
    {
        statusCallback: `${NEXT_PUBLIC_BASE_URL}/api/twilio/status`,
        statusCallbackEvent: ['start', 'end', 'join', 'leave', 'mute', 'hold'],
    },
    conferenceName
  );

  return new Response(response.toString(), {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}
