import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_API_SECRET,
  TWILIO_TWIML_APP_SID,
} = process.env;

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

export async function GET(req: NextRequest) {
  if (
    !TWILIO_ACCOUNT_SID ||
    !TWILIO_API_KEY_SID ||
    !TWILIO_API_SECRET ||
    !TWILIO_TWIML_APP_SID
  ) {
    return NextResponse.json(
      { error: 'Twilio environment variables not configured' },
      { status: 500 }
    );
  }

  const identity = `user_${Math.random().toString(36).substring(7)}`;

  const accessToken = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID,
    TWILIO_API_SECRET,
    { identity }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWILIO_TWIML_APP_SID,
    incomingAllow: true, 
  });
  accessToken.addGrant(voiceGrant);

  const token = accessToken.toJwt();

  return NextResponse.json({ token, identity });
}
