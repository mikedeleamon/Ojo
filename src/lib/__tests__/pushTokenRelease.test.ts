/**
 * Sign-out releases this phone's push token.
 *
 * The bug this closes: signing out left the phone's token on the account
 * leaving, so that account's server pushes (closet-gap nudges, weather
 * alerts) kept arriving for its own home city while someone else's account
 * was signed in on the phone.
 */

const mockPermission = { status: 'granted' };

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project' } } } },
}));
jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    defaults: { baseURL: 'https://api.example' },
    get: jest.fn(),
    post: jest.fn(async () => ({ data: { success: true } })),
    delete: jest.fn(),
  },
}));
jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn(async () => ({ data: { success: true } })) },
}));
jest.mock('../auth', () => ({
  getToken: jest.fn(() => 'session'),
  authHeaders: jest.fn(() => ({ headers: { Authorization: 'Bearer session' } })),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => mockPermission),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[phone]' })),
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
  AndroidImportance: { DEFAULT: 3 },
}));

import { registerPushToken, releasePushToken } from '../notifications';

const rawPost = (jest.requireMock('axios') as { default: { post: jest.Mock } }).default.post;
const clientPost = (jest.requireMock('../../api/client') as { default: { post: jest.Mock } }).default.post;
const expoToken = (jest.requireMock('expo-notifications') as { getExpoPushTokenAsync: jest.Mock })
  .getExpoPushTokenAsync;

const LEAVING = { headers: { Authorization: 'Bearer leaving' } };

beforeEach(async () => {
  mockPermission.status = 'granted';
  // Clear whatever an earlier test registered.
  await releasePushToken(LEAVING);
  jest.clearAllMocks();
});

it('sends the registered token with the leaving account’s session, around the API client', async () => {
  await registerPushToken();
  await releasePushToken(LEAVING);

  expect(rawPost).toHaveBeenCalledWith(
    '/api/notifications/token/release',
    { pushToken: 'ExponentPushToken[phone]' },
    expect.objectContaining({ ...LEAVING, baseURL: 'https://api.example' }),
  );
  // Only the registration went through the client; the release didn't.
  expect(clientPost).toHaveBeenCalledTimes(1);
  expect(clientPost.mock.calls[0][0]).toBe('/api/notifications/token');
});

it('asks Expo for the token when this session never registered it', async () => {
  await releasePushToken(LEAVING);
  expect(expoToken).toHaveBeenCalled();
  expect(rawPost).toHaveBeenCalledWith(
    '/api/notifications/token/release',
    { pushToken: 'ExponentPushToken[phone]' },
    expect.anything(),
  );
});

it('sends nothing without a session to speak for', async () => {
  await registerPushToken();
  await releasePushToken({});
  expect(rawPost).not.toHaveBeenCalled();
});

it('sends nothing when notifications were never allowed', async () => {
  mockPermission.status = 'denied';
  await releasePushToken(LEAVING);
  expect(rawPost).not.toHaveBeenCalled();
});

it('a failed release doesn’t throw into sign-out', async () => {
  await registerPushToken();
  rawPost.mockRejectedValueOnce(new Error('offline'));
  await expect(releasePushToken(LEAVING)).resolves.toBeUndefined();
});
