import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const tokenRecord = await prisma.googleCalendarToken.findUnique({
    where: { userId: session.userId },
  });

  if (!tokenRecord) {
    return NextResponse.json({ error: 'Google Calendar not connected', connected: false }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({
    access_token: tokenRecord.accessToken,
    refresh_token: tokenRecord.refreshToken,
    expiry_date: tokenRecord.expiryDate ? Number(tokenRecord.expiryDate) : undefined,
  });

  // Auto-refresh token if expired
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await prisma.googleCalendarToken.update({
        where: { userId: session.userId },
        data: {
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date ? String(tokens.expiry_date) : null,
        },
      });
    }
  });

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const { searchParams } = new URL(request.url);
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax');
    const maxResults = parseInt(searchParams.get('maxResults') || '50');

    const params: Record<string, unknown> = {
      calendarId: 'primary',
      timeMin,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    };

    if (timeMax) {
      params.timeMax = timeMax;
    }

    const response = await calendar.events.list(params);

    const events = (response.data.items || []).map((event) => ({
      id: event.id,
      title: event.summary || '(No title)',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      isAllDay: !event.start?.dateTime,
      description: event.description || null,
      location: event.location || null,
    }));

    return NextResponse.json({ events, connected: true });
  } catch (err: unknown) {
    const error = err as { code?: number; message?: string };
    if (error.code === 401) {
      // Token might be revoked
      await prisma.googleCalendarToken.deleteMany({
        where: { userId: session.userId },
      });
      return NextResponse.json({ error: 'Token expired, please reconnect', connected: false }, { status: 401 });
    }
    console.error('Google Calendar API error:', error.code, error.message, JSON.stringify(err));
    return NextResponse.json({ error: 'Failed to fetch calendar events', details: error.message, code: error.code }, { status: 500 });
  }
}