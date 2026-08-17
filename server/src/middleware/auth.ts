import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import User from '../models/User';
import { isAgeVerified } from '../lib/age';

export interface AuthRequest extends Request {
  userId?: string;
  /**
   * Whether the authenticated account has cleared the minimum-age gate.
   * Resolved by requireAuth from the same document lookup that checks
   * tokenVersion, so requireAgeVerified below costs no extra query.
   */
  ageVerified?: boolean;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // Idempotent: several routers mount requireAuth themselves and are also
  // mounted behind it in index.ts (so requireAgeVerified has something to read).
  // Without this guard that pairing would cost a second identical user lookup
  // on every request to those routers.
  if (req.userId) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub)
      .select('tokenVersion birthday ageVerifiedAt')
      .lean();
    if (!user || (payload.ver ?? 0) !== user.tokenVersion) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.userId = payload.sub;
    // `ageVerifiedAt` is the fast path for accounts that have passed the gate.
    // Falling back to re-validating the stored birthday means accounts that
    // predate the field don't all get re-prompted on deploy — only the ones
    // that genuinely never supplied a usable date of birth.
    req.ageVerified = !!user.ageVerifiedAt || isAgeVerified(user.birthday);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Blocks routes that store or return personal data until the account has
 * cleared the minimum-age gate (see lib/age.ts).
 *
 * This is what makes the gate a control rather than a suggestion: the app
 * routes unverified users to the age screen, but a caller that ignores the UI
 * still cannot read or write closet, history, trip, or notification data.
 *
 * Must be mounted after requireAuth, which resolves `req.ageVerified`.
 *
 * Deliberately NOT applied to /api/auth (the user needs /verify-age to get out
 * of this state) or /api/user (so they can still view their profile, fix their
 * settings, or delete the account outright).
 */
export const requireAgeVerified = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.ageVerified) {
    next();
    return;
  }
  res.status(403).json({
    error: 'Date of birth required before this account can be used',
    code:  'AGE_VERIFICATION_REQUIRED',
  });
};
