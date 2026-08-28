import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import { signToken } from '../lib/jwt';
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  generateResetToken,
  hashResetToken,
  buildResetDeepLink,
  sendResetEmail,
} from '../lib/passwordReset';
import { verifyAppleIdentityToken } from '../lib/appleAuth';
import { verifyGoogleIdToken } from '../lib/googleAuth';
import { validateBirthday, isAgeVerified } from '../lib/age';
import { deleteManyFromR2 } from '../lib/r2';
import Closet from '../models/Closet';
import OutfitHistory from '../models/OutfitHistory';
import Trip from '../models/Trip';
import TripFitPlan from '../models/TripFitPlan';

const router = Router();

/** Every OAuth client ID a Google ID token may legitimately be issued for. */
function googleAllowedAudiences(): string[] {
  return [
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
  ].filter((v): v is string => !!v);
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: 'identifier and password are required' });
      return;
    }
    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    res.json({
      token: signToken(user.id, user.tokenVersion),
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      settings: user.settings,
      // Accounts created before the age gate carry an empty birthday. Flagging
      // them here sends the app to the gate on the next launch instead of
      // silently grandfathering an unverified account.
      needsAgeVerification: !isAgeVerified(user.birthday),
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, username, email, password, birthday } = req.body;
    if (!firstName || !lastName || !username || !email || !password) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Age gate. The app validates the same rules before submitting, but this is
    // the check that counts — the endpoint is reachable without it. An underage
    // date is refused here so no personal information is ever written.
    const age = validateBirthday(birthday);
    if (!age.ok) {
      res.status(age.reason === 'underage' ? 403 : 400).json({
        error: age.message,
        code:  age.reason === 'underage' ? 'UNDERAGE' : 'INVALID_BIRTHDAY',
      });
      return;
    }

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existing) {
      res.status(409).json({ error: 'Email or username already in use' });
      return;
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstName,
      lastName,
      username,
      email: email.toLowerCase(),
      password: hashed,
      birthday: String(birthday).trim(),
      ageVerifiedAt: new Date(),
    });
    res.status(201).json({
      token: signToken(user.id, user.tokenVersion),
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      settings: user.settings,
      needsAgeVerification: false,
    });
  } catch (err) {
    console.error('[auth] signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Always returns 204, regardless of whether the email is registered, so the
 * endpoint cannot be used to enumerate accounts.
 */
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const { raw, hash, expiresAt } = generateResetToken();
      user.resetPasswordTokenHash = hash;
      user.resetPasswordExpires   = expiresAt;
      await user.save();

      try {
        await sendResetEmail(user.email, buildResetDeepLink(raw));
      } catch (err) {
        // Never let email failures leak to the client.
        console.error('[auth] sendResetEmail failed:', err);
      }
    }

    res.sendStatus(204);
  } catch (err) {
    console.error('[auth] forgot-password error:', err);
    // Still 204 — same response for failure as for unknown email.
    res.sendStatus(204);
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 *
 * Verifies the SHA-256 hash of the supplied token against any non-expired
 * user, sets the new password, and bumps tokenVersion to revoke other
 * sessions.
 */
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: 'token and newPassword are required' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const tokenHash = hashResetToken(String(token));
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires:   { $gt: new Date() },
    }).select('+resetPasswordTokenHash +resetPasswordExpires');

    if (!user) {
      res.status(400).json({ error: 'Reset link is invalid or has expired' });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires   = undefined;
    await user.save();

    res.json({
      token: signToken(user.id, user.tokenVersion),
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      settings: user.settings,
      needsAgeVerification: !isAgeVerified(user.birthday),
    });
  } catch (err) {
    console.error('[auth] reset-password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/apple
 * Body: { identityToken, fullName?: { givenName, familyName } }
 *
 * Verifies the Apple identity token, then:
 *  - looks up an existing user by `appleSub`
 *  - falls back to lookup by `email` (so users who already signed up with
 *    email/password can link Sign in with Apple to that account)
 *  - otherwise creates a new account
 *
 * Returns the same shape as /login and /signup: { token, user, settings }.
 */
router.post('/apple', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identityToken, fullName } = req.body ?? {};
    if (!identityToken || typeof identityToken !== 'string') {
      res.status(400).json({ error: 'identityToken is required' });
      return;
    }
    const audience = process.env.APPLE_BUNDLE_ID;
    if (!audience) {
      console.error('[auth] APPLE_BUNDLE_ID is not set');
      res.status(500).json({ error: 'Server not configured for Sign in with Apple' });
      return;
    }

    let claims;
    try {
      claims = await verifyAppleIdentityToken(identityToken, audience);
    } catch (err) {
      console.warn('[auth] Apple identity token verification failed:', err);
      res.status(401).json({ error: 'Invalid Apple identity token' });
      return;
    }

    // 1) Look up by Apple sub
    let user = await User.findOne({ appleSub: claims.sub });

    // 2) Fallback: link to existing email/password account by email — but only
    // when Apple has itself confirmed the address. An unverified email claim
    // must never be trusted to take over an existing account; Apple encodes
    // this as the string "true"/"false" rather than a boolean.
    const appleEmailVerified = claims.email_verified === true || claims.email_verified === 'true';
    if (!user && claims.email && appleEmailVerified) {
      const byEmail = await User.findOneAndUpdate(
        { email: claims.email.toLowerCase() },
        { $set: { appleSub: claims.sub } },
        { new: true },
      );
      if (byEmail) user = byEmail;
    }

    // An account already holds this address but the token didn't prove
    // ownership of it, so linking above was (correctly) skipped. Creating a
    // second account would violate the unique email index and surface as an
    // opaque 500, so answer with something the user can act on instead.
    if (!user && claims.email && !appleEmailVerified) {
      if (await User.exists({ email: claims.email.toLowerCase() })) {
        res.status(409).json({
          error: 'An account already uses this email. Sign in with your password instead.',
          code:  'EMAIL_NOT_VERIFIED',
        });
        return;
      }
    }

    // Whether this request created a brand-new account — the client uses this
    // to run first-run onboarding (mirrors the email/password sign-up form).
    const isNewUser = !user;

    // 3) Otherwise create a new user.
    // Apple only sends fullName on the very first sign-in — fall back gracefully.
    if (!user) {
      const firstName = fullName?.givenName?.trim()  || 'Apple';
      const lastName  = fullName?.familyName?.trim() || 'User';
      // Username falls back to the Apple sub if no email is shared (private relay)
      const usernameSeed = claims.email
        ? claims.email.split('@')[0]
        : `apple_${claims.sub.slice(0, 10)}`;
      // Make username unique by suffixing a short random tag on collision
      let username = usernameSeed;
      if (await User.exists({ username })) {
        username = `${usernameSeed}_${Math.random().toString(36).slice(2, 6)}`;
      }

      // Password is a random throw-away — the user authenticates via Apple,
      // not bcrypt. They can still set a real password later via /reset-password.
      const randomPwd = (await import('crypto')).randomBytes(32).toString('base64url');
      const bcrypt    = (await import('bcrypt')).default;

      user = await User.create({
        firstName,
        lastName,
        username,
        email:    claims.email ? claims.email.toLowerCase() : `${claims.sub}@privaterelay.appleid.com`,
        password: await bcrypt.hash(randomPwd, 12),
        appleSub: claims.sub,
      });
    }

    res.json({
      token: signToken(user.id, user.tokenVersion),
      user:  { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      settings: user.settings,
      isNewUser,
      // Neither Apple nor Google returns a date of birth, so a brand-new OAuth
      // account has never cleared the age gate. The app must collect one via
      // POST /api/auth/verify-age before any data route will answer.
      needsAgeVerification: !isAgeVerified(user.birthday),
    });
  } catch (err) {
    console.error('[auth] apple sign-in error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/google
 * Body: { idToken }
 *
 * Verifies the Google ID token, then (mirroring /apple):
 *  - looks up an existing user by `googleSub`
 *  - falls back to lookup by `email` (links Google to an email/password account)
 *  - otherwise creates a new account
 *
 * Returns the same shape as /login and /signup: { token, user, settings }.
 */
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body ?? {};
    if (!idToken || typeof idToken !== 'string') {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }
    const audiences = googleAllowedAudiences();
    if (audiences.length === 0) {
      console.error('[auth] No GOOGLE_*_CLIENT_ID configured');
      res.status(500).json({ error: 'Server not configured for Sign in with Google' });
      return;
    }

    let claims;
    try {
      claims = await verifyGoogleIdToken(idToken, audiences);
    } catch (err) {
      console.warn('[auth] Google ID token verification failed:', err);
      res.status(401).json({ error: 'Invalid Google identity token' });
      return;
    }

    // 1) Look up by Google sub
    let user = await User.findOne({ googleSub: claims.sub });

    // 2) Fallback: link to existing email/password account by email — but only
    // when Google has itself confirmed the address. An unverified email claim
    // must never be trusted to take over an existing account.
    if (!user && claims.email && claims.email_verified) {
      const byEmail = await User.findOneAndUpdate(
        { email: claims.email.toLowerCase() },
        { $set: { googleSub: claims.sub } },
        { new: true },
      );
      if (byEmail) user = byEmail;
    }

    // See the Apple route: an unverified claim must not link, and must not fall
    // through into a create that trips the unique email index and 500s.
    if (!user && claims.email && !claims.email_verified) {
      if (await User.exists({ email: claims.email.toLowerCase() })) {
        res.status(409).json({
          error: 'An account already uses this email. Sign in with your password instead.',
          code:  'EMAIL_NOT_VERIFIED',
        });
        return;
      }
    }

    // Whether this request created a brand-new account — the client uses this
    // to run first-run onboarding (mirrors the email/password sign-up form).
    const isNewUser = !user;

    // 3) Otherwise create a new user
    if (!user) {
      const nameParts  = (claims.name ?? '').split(' ');
      const firstName  = claims.given_name?.trim()  || nameParts[0]  || 'Google';
      const lastName   = claims.family_name?.trim() || nameParts.slice(1).join(' ') || 'User';
      const usernameSeed = claims.email
        ? claims.email.split('@')[0]
        : `google_${claims.sub.slice(0, 10)}`;
      // Make username unique by suffixing a short random tag on collision
      let username = usernameSeed;
      if (await User.exists({ username })) {
        username = `${usernameSeed}_${Math.random().toString(36).slice(2, 6)}`;
      }

      // Throw-away password — the user authenticates via Google, not bcrypt.
      const randomPwd = (await import('crypto')).randomBytes(32).toString('base64url');
      const bcrypt    = (await import('bcrypt')).default;

      user = await User.create({
        firstName,
        lastName,
        username,
        email:    claims.email ? claims.email.toLowerCase() : `${claims.sub}@users.noreply.google.com`,
        password: await bcrypt.hash(randomPwd, 12),
        googleSub: claims.sub,
      });
    }

    res.json({
      token: signToken(user.id, user.tokenVersion),
      user:  { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      settings: user.settings,
      isNewUser,
      // Neither Apple nor Google returns a date of birth, so a brand-new OAuth
      // account has never cleared the age gate. The app must collect one via
      // POST /api/auth/verify-age before any data route will answer.
      needsAgeVerification: !isAgeVerified(user.birthday),
    });
  } catch (err) {
    console.error('[auth] google sign-in error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/verify-age
 * Body: { birthday }  — "MM/DD/YYYY"
 *
 * The age gate for accounts that never passed through the sign-up form: every
 * Apple/Google sign-up (neither provider returns a date of birth) and every
 * account created before the gate existed.
 *
 * On a valid adult date this stamps `ageVerifiedAt` and the account unlocks.
 *
 * On an underage date the account and everything attached to it is deleted.
 * That is deliberate, not punitive: once a user tells us they are under 13,
 * COPPA does not allow us to keep holding their personal information, and the
 * account only exists because Apple/Google let them create one without ever
 * being asked. Erasure here mirrors DELETE /api/user/me exactly.
 */
router.post('/verify-age', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { birthday } = req.body ?? {};
    const age = validateBirthday(birthday);

    if (!age.ok && age.reason !== 'underage') {
      res.status(400).json({ error: age.message, code: 'INVALID_BIRTHDAY' });
      return;
    }

    if (!age.ok) {
      // Under 13 — purge the account rather than retain it.
      const closets = await Closet.find({ userId: req.userId }).select('articles.imageUrl').lean();
      const imageUrls = closets.flatMap(c => (c.articles ?? []).map(a => a.imageUrl));

      await Promise.all([
        User.findByIdAndDelete(req.userId),
        Closet.deleteMany({ userId: req.userId }),
        OutfitHistory.deleteMany({ userId: req.userId }),
        Trip.deleteMany({ userId: req.userId }),
        TripFitPlan.deleteMany({ userId: req.userId }),
      ]);

      res.status(403).json({ error: age.message, code: 'UNDERAGE_ACCOUNT_DELETED' });

      // After the response, for the same reason as DELETE /api/user/me: a slow
      // or unavailable R2 must not turn a completed deletion into a 500.
      deleteManyFromR2(imageUrls).catch(err =>
        console.error('[auth] R2 cleanup error after underage deletion:', err),
      );
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { birthday: String(birthday).trim(), ageVerifiedAt: new Date() } },
      { new: true },
    );
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.json({ needsAgeVerification: false });
  } catch (err) {
    console.error('[auth] verify-age error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('tokenVersion').lean();
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ token: signToken(String(user._id), user.tokenVersion) });
  } catch (err) {
    console.error('[auth] refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
