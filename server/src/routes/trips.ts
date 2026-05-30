import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getGmailAuthUrl, exchangeCode, syncGmailTrips, verifyState } from '../lib/gmailParser';
import User from '../models/User';
import Trip from '../models/Trip';

const router = Router();

// ─── Gmail OAuth (public — no auth middleware) ────────────────────────────────

/**
 * GET /api/trips/gmail/connect
 * App calls this to get the Google consent URL, then opens it in expo-web-browser.
 * Requires the user's JWT so we know who to link the token to.
 */
router.get('/gmail/connect', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Pass userId as OAuth state so the callback can credit the right user
    const url = getGmailAuthUrl(req.userId!);
    res.json({ url });
  } catch (err) {
    console.error('[trips] connect error:', err);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/trips/gmail/callback
 * Google redirects here after the user consents.
 * Stores the refresh token, then redirects to the app deep link.
 */
router.get('/gmail/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>;
  const errorRedirect = `${process.env.APP_DEEP_LINK_SCHEME ?? 'ojo'}://gmail-connected?status=error`;

  if (error || !code || !state) {
    res.redirect(errorRedirect);
    return;
  }

  // Verify the HMAC-signed state so an attacker cannot pair a stolen `code`
  // with a victim's userId.
  const userId = verifyState(state);
  if (!userId) {
    console.error('[trips] callback: invalid state signature');
    res.redirect(errorRedirect);
    return;
  }

  try {
    const refreshToken = await exchangeCode(code);
    await User.findByIdAndUpdate(userId, {
      googleRefreshToken:     refreshToken,
      googleConnectedAt:      new Date(),
    });

    // Kick off initial sync in the background (don't await)
    syncGmailTrips(userId).catch(err =>
      console.error('[trips] initial sync error:', err)
    );

    res.redirect(`${process.env.APP_DEEP_LINK_SCHEME ?? 'ojo'}://gmail-connected?status=ok`);
  } catch (err) {
    console.error('[trips] callback error:', err);
    res.redirect(errorRedirect);
  }
});

/**
 * GET /api/trips/gmail/status
 * Returns whether Gmail is connected for the current user.
 */
router.get('/gmail/status', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId)
      .select('googleRefreshToken googleConnectedAt')
      .lean();

    res.json({
      connected: !!user?.googleRefreshToken,
      connectedAt: user?.googleConnectedAt ?? null,
    });
  } catch (err) {
    console.error('[trips] status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/trips/gmail/disconnect
 * Revokes Gmail access and removes the stored token.
 */
router.delete('/gmail/disconnect', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $unset: { googleRefreshToken: '', googleConnectedAt: '' },
    });
    res.sendStatus(204);
  } catch (err) {
    console.error('[trips] disconnect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── All routes below require auth ───────────────────────────────────────────
router.use(requireAuth);

/**
 * POST /api/trips/gmail/sync
 * Manually trigger a Gmail scan (app calls this after connect, or on pull-to-refresh).
 */
router.post('/gmail/sync', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await syncGmailTrips(req.userId!);
    res.json(result); // { added, skipped, errors }
  } catch (err: any) {
    if (err?.message?.includes('no refresh token')) {
      res.status(400).json({ error: 'Gmail not connected' });
    } else {
      console.error('[trips] sync error:', err);
      res.status(500).json({ error: 'Sync failed' });
    }
  }
});

/**
 * GET /api/trips
 * Returns all upcoming trips for the user, soonest first.
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const trips = await Trip.find({
      userId: req.userId,
      departureDate: { $gte: new Date() }, // future trips only
    })
      .sort({ departureDate: 1 })
      .lean();

    res.json(trips);
  } catch (err) {
    console.error('[trips] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/trips
 * Manually add a trip (no Gmail required).
 */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    airline, confirmationNumber,
    departureDate, returnDate,
    originAirport, destinationAirport, destinationCity,
  } = req.body;

  if (!airline || !departureDate || !originAirport || !destinationAirport) {
    res.status(400).json({
      error: 'airline, departureDate, originAirport, and destinationAirport are required',
    });
    return;
  }

  try {
    const trip = await Trip.create({
      userId:             new Types.ObjectId(req.userId),
      airline,
      confirmationNumber: confirmationNumber ?? '',
      departureDate:      new Date(departureDate),
      returnDate:         returnDate ? new Date(returnDate) : undefined,
      originAirport:      originAirport.toUpperCase(),
      destinationAirport: destinationAirport.toUpperCase(),
      destinationCity:    destinationCity ?? '',
      source:             'manual',
    });
    res.status(201).json(trip);
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ error: 'A trip with that confirmation number already exists' });
    } else {
      console.error('[trips] create error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * DELETE /api/trips/:id
 * Remove a trip (works for both manual and Gmail-imported).
 */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deleted = await Trip.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!deleted) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    console.error('[trips] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
