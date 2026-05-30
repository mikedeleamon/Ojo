/**
 * gmailParser.ts
 *
 * Gmail OAuth + airline confirmation email parser for Ojo's Smart Trip Planner.
 *
 * Flow:
 *  1. User taps "Connect Gmail" → app calls GET /api/trips/gmail/connect → gets OAuth URL
 *  2. App opens URL in in-app browser (expo-web-browser openAuthSessionAsync)
 *  3. Google redirects to GET /api/trips/gmail/callback → we store the refresh token
 *  4. App (or cron) calls POST /api/trips/gmail/sync → this file does the heavy lifting
 */

import crypto from 'crypto';
import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';
import User from '../models/User';
import Trip from '../models/Trip';
import { Types } from 'mongoose';

// ─── OAuth state signing ──────────────────────────────────────────────────────
// `state` is round-tripped through Google to bind the callback to a specific
// user. Signing it with HMAC-SHA256 prevents an attacker from posting a stolen
// authorization code together with a victim's userId.

function stateSecret(): string {
  // Reuse JWT_SECRET — it's already a strong server-only secret.
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to sign OAuth state');
  return secret;
}

export function signState(userId: string): string {
  const sig = crypto.createHmac('sha256', stateSecret()).update(userId).digest('base64url');
  return `${userId}.${sig}`;
}

export function verifyState(state: string): string | null {
  const dot = state.lastIndexOf('.');
  if (dot < 0) return null;
  const userId = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = crypto.createHmac('sha256', stateSecret()).update(userId).digest('base64url');
  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? userId : null;
}

// ─── OAuth client ─────────────────────────────────────────────────────────────

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI, // e.g. http://localhost:4000/api/trips/gmail/callback
  );
}

/** Returns the Google consent-screen URL to redirect/open in browser. */
export function getGmailAuthUrl(userId: string): string {
  const client = makeOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force refresh token on every auth
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    // HMAC-signed so the callback can reject forged state values
    state: signState(userId),
  });
}

/** Exchange a one-time code for tokens; returns the refresh token. */
export async function exchangeCode(code: string): Promise<string> {
  const client = makeOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned — user may need to revoke & re-authorize.');
  }
  return tokens.refresh_token;
}

// ─── Known airline sender domains ────────────────────────────────────────────

const AIRLINE_DOMAINS: Record<string, string> = {
  'aa.com':              'American Airlines',
  'americanairlines.com':'American Airlines',
  'delta.com':           'Delta',
  't.delta.com':         'Delta',
  'united.com':          'United',
  'ual.com':             'United',
  'southwest.com':       'Southwest',
  'luv.southwest.com':   'Southwest',
  'jetblue.com':         'JetBlue',
  'spirit.com':          'Spirit Airlines',
  'alaskaair.com':       'Alaska Airlines',
  'flyfrontier.com':     'Frontier',
  'allegiantair.com':    'Allegiant',
  'hawaiianairlines.com':'Hawaiian Airlines',
};

const SENDER_QUERY = Object.keys(AIRLINE_DOMAINS)
  .map(d => `from:${d}`)
  .join(' OR ');

const GMAIL_SEARCH = `(${SENDER_QUERY}) (confirmation OR booking OR reservation OR itinerary) newer_than:180d`;

function detectAirline(from: string): string {
  for (const [domain, name] of Object.entries(AIRLINE_DOMAINS)) {
    if (from.toLowerCase().includes(domain)) return name;
  }
  return 'Unknown Airline';
}

// ─── IATA airport code allowlist (top 80 US + common international) ──────────

const KNOWN_AIRPORTS = new Set([
  // US domestic
  'ATL','LAX','ORD','DFW','DEN','JFK','SFO','SEA','LAS','MCO',
  'CLT','PHX','MIA','IAH','BOS','MSP','FLL','DTW','PHL','LGA',
  'BWI','MDW','SLC','DCA','SAN','HNL','TPA','PDX','STL','BNA',
  'AUS','OAK','MSY','RDU','SJC','SMF','RSW','MCI','CLE','MKE',
  'PIT','CVG','IND','CMH','SAT','JAX','BDL','ABQ','OMA','TUS',
  'ELP','BUF','BHM','RIC','ONT','ORF','PVD','MEM','GRR','BOI',
  'SNA','SJU','BUR','LGB','SBN','SDF','DSM','ICT','LIT','CHS',
  'ROC','ALB','GSO','TUL','OKC','DAL','HOU','MDT','PNS','VPS',
  // International
  'LHR','LGW','CDG','ORY','FRA','MUC','AMS','BCN','MAD','FCO',
  'LIN','ZRH','GVA','CPH','ARN','OSL','HEL','DUB','BRU','VIE',
  'NRT','HND','ICN','PVG','PEK','HKG','SIN','BKK','KUL','CGK',
  'DXB','AUH','DOH','IST','TLV','CAI','JNB','CPT','NBO','ADD',
  'SYD','MEL','BNE','AKL','YYZ','YVR','YUL','CUN','GDL','MTY',
  'MEX','GRU','GIG','SCL','BOG','LIM','EZE','UIO','PTY','MDE',
]);

// ─── Text extraction from Gmail message payload ───────────────────────────────

function decodeBase64(encoded: string): string {
  return Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractText(payload: gmail_v1.Schema$MessagePart): string {
  if (!payload) return '';

  // Direct body data
  if (payload.body?.data) {
    const decoded = decodeBase64(payload.body.data);
    return payload.mimeType === 'text/html' ? stripHtml(decoded) : decoded;
  }

  if (!payload.parts) return '';

  // Prefer text/plain, fall back to text/html
  const plain = payload.parts.find(p => p.mimeType === 'text/plain');
  if (plain?.body?.data) return decodeBase64(plain.body.data);

  const html = payload.parts.find(p => p.mimeType === 'text/html');
  if (html?.body?.data) return stripHtml(decodeBase64(html.body.data));

  // Recurse into multipart
  for (const part of payload.parts) {
    const text = extractText(part);
    if (text) return text;
  }

  return '';
}

// ─── Field extractors ─────────────────────────────────────────────────────────

function extractConfirmation(text: string): string {
  const patterns = [
    /confirmation\s+(?:code|number|#)[\s:]+([A-Z0-9]{4,8})/i,
    /booking\s+(?:reference|code|#)[\s:]+([A-Z0-9]{4,8})/i,
    /reservation\s+(?:code|number|#)[\s:]+([A-Z0-9]{4,8})/i,
    /record\s+locator[\s:]+([A-Z0-9]{4,8})/i,
    /\bconf(?:irmation)?\.?\s*#?[\s:]+([A-Z0-9]{4,8})/i,
    /\bPNR[\s:]+([A-Z0-9]{4,8})/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].toUpperCase();
  }
  return '';
}

function extractAirports(text: string): string[] {
  const found: string[] = [];

  // Pattern 1: (LAX) — city in parentheses
  for (const m of text.matchAll(/\(([A-Z]{3})\)/g)) {
    if (KNOWN_AIRPORTS.has(m[1])) found.push(m[1]);
  }

  // Pattern 2: LAX → JFK or LAX - JFK
  for (const m of text.matchAll(/\b([A-Z]{3})\s*[→\-–]\s*([A-Z]{3})\b/g)) {
    if (KNOWN_AIRPORTS.has(m[1])) found.push(m[1]);
    if (KNOWN_AIRPORTS.has(m[2])) found.push(m[2]);
  }

  // Pattern 3: standalone known code near departure/arrival keywords
  const nearKeyword = /(?:depart(?:ing|ure)?|arriv(?:ing|al)?|from|to|origin|destination)[\s:]+([A-Z]{3})\b/gi;
  for (const m of text.matchAll(nearKeyword)) {
    if (KNOWN_AIRPORTS.has(m[1])) found.push(m[1]);
  }

  // Deduplicate while preserving order
  return [...new Set(found)];
}

const MONTH_MAP: Record<string, number> = {
  january:0,february:1,march:2,april:3,may:4,june:5,
  july:6,august:7,september:8,october:9,november:10,december:11,
  jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
};

function parseDate(raw: string): Date | null {
  // Try native Date first
  const native = new Date(raw.trim());
  if (!isNaN(native.getTime())) return native;

  // "December 20, 2025" / "Dec 20 2025"
  const wordy = raw.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (wordy) {
    const month = MONTH_MAP[wordy[1].toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(wordy[3]), month, parseInt(wordy[2]));
    }
  }

  return null;
}

function extractDates(text: string): Date[] {
  const dates: Date[] = [];
  const patterns = [
    // ISO: 2025-12-20
    /\b(\d{4}-\d{2}-\d{2})\b/g,
    // MM/DD/YYYY
    /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g,
    // Month DD, YYYY or Month DD YYYY
    /\b((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})\b/gi,
  ];

  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const d = parseDate(m[1]);
      if (d && d > new Date()) dates.push(d); // only future trips
    }
  }

  // Sort ascending
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

// ─── Main parser ──────────────────────────────────────────────────────────────

interface ParsedFlight {
  airline:            string;
  confirmationNumber: string;
  departureDate:      Date;
  returnDate?:        Date;
  originAirport:      string;
  destinationAirport: string;
  destinationCity:    string;
}

function parseEmail(body: string, from: string): ParsedFlight | null {
  const airline            = detectAirline(from);
  const confirmationNumber = extractConfirmation(body);
  const airports           = extractAirports(body);
  const dates              = extractDates(body);

  if (airports.length < 2 || dates.length < 1) return null; // not enough data

  const [originAirport, destinationAirport] = airports;
  const [departureDate, maybeReturn]        = dates;

  // Extract destination city: look for "City Name (XXX)" pattern
  const cityPattern = new RegExp(`([A-Z][a-z]+(?: [A-Z][a-z]+)*)\\s*\\(${destinationAirport}\\)`);
  const cityMatch   = body.match(cityPattern);
  const destinationCity = cityMatch ? cityMatch[1] : '';

  return {
    airline,
    confirmationNumber,
    departureDate,
    returnDate: maybeReturn && maybeReturn !== departureDate ? maybeReturn : undefined,
    originAirport,
    destinationAirport,
    destinationCity,
  };
}

// ─── Main sync function ───────────────────────────────────────────────────────

export interface SyncResult {
  added:   number;
  skipped: number;
  errors:  number;
}

export async function syncGmailTrips(userId: string): Promise<SyncResult> {
  const user = await User.findById(userId).select('googleRefreshToken').lean();
  if (!user?.googleRefreshToken) {
    throw new Error('Gmail not connected — no refresh token stored.');
  }

  const oAuth2 = makeOAuth2Client();
  oAuth2.setCredentials({ refresh_token: user.googleRefreshToken });

  const gmail = google.gmail({ version: 'v1', auth: oAuth2 });

  // Search for airline emails
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: GMAIL_SEARCH,
    maxResults: 50,
  });

  const messages = listRes.data.messages ?? [];
  let added = 0, skipped = 0, errors = 0;

  for (const msg of messages) {
    if (!msg.id) continue;

    // Skip already-imported messages
    const exists = await Trip.exists({ userId, gmailMessageId: msg.id });
    if (exists) { skipped++; continue; }

    try {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const payload = full.data.payload;
      if (!payload) { skipped++; continue; }

      const from = payload.headers?.find(h => h.name === 'From')?.value ?? '';
      const body = extractText(payload);
      const parsed = parseEmail(body, from);

      if (!parsed) { skipped++; continue; }

      await Trip.create({
        userId:             new Types.ObjectId(userId),
        gmailMessageId:     msg.id,
        source:             'gmail',
        lastSyncedAt:       new Date(),
        ...parsed,
      });
      added++;
    } catch (err: any) {
      // Duplicate key = already imported via another path; anything else = log
      if (err?.code === 11000) { skipped++; }
      else { console.error('[gmailParser] error processing message', msg.id, err); errors++; }
    }
  }

  return { added, skipped, errors };
}
