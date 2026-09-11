import { Router, Request, Response } from 'express';
import User from '../models/User';
import { classifyEvent, isAuthorizedWebhook } from '../lib/revenuecatEntitlement';

/**
 * RevenueCat webhook — mirrors purchase state into `User.isPro` so
 * entitlement gating is consistent across devices instead of trusting each
 * client's own local CustomerInfo. See docs/iap-implementation-plan.md Step 5.
 */

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  original_app_user_id?: string;
  entitlement_ids?: string[] | null;
}

const router = Router();

router.post('/webhook', async (req: Request, res: Response) => {
  if (!isAuthorizedWebhook(req.get('authorization') ?? undefined, process.env.REVENUECAT_WEBHOOK_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const event: RevenueCatEvent | undefined = req.body?.event;
  if (!event?.type || !event?.app_user_id) {
    res.status(400).json({ error: 'Malformed event' });
    return;
  }

  const action = classifyEvent(event.type, event.entitlement_ids);
  if (action === 'ignore') {
    res.status(200).json({ ok: true });
    return;
  }

  // app_user_id is whatever Ojo passed to Purchases.logIn — always the
  // account's own Mongo _id, and only ever called once already authenticated
  // (see PurchasesContext.tsx), so there is no anonymous-purchase-then-login
  // case here. original_app_user_id is a cheap fallback for the identity
  // merge RevenueCat's own docs warn can otherwise happen, not a load-bearing
  // lookup path. findById throws on a non-ObjectId string (e.g. a RevenueCat
  // anonymous id), which the catches below turn into a plain miss.
  const user =
    (await User.findById(event.app_user_id).catch(() => null)) ??
    (event.original_app_user_id
      ? await User.findById(event.original_app_user_id).catch(() => null)
      : null);

  if (!user) {
    res.status(404).json({ error: 'Unknown user' });
    return;
  }

  user.isPro = action === 'grant';
  await user.save();
  res.status(200).json({ ok: true });
});

export default router;
