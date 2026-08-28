/**
 * Legal document configuration.
 *
 * URLS: Replace placeholders with your hosted URLs once live.
 *       While a URL is a placeholder the modal renders inline content instead.
 *
 * CONTENT: The full text of each document, mirroring the Word docs produced
 *          for the compliance report. Update here whenever you revise the docs.
 */

export const LEGAL_URLS = {
  //privacyPolicy:   '[REPLACE_WITH_HOSTED_URL]/privacy',
  //termsOfService:  '[REPLACE_WITH_HOSTED_URL]/terms',
  privacyPolicy:   'https://www.ojoapp.io/privacy',
  termsOfService:  'https://www.ojoapp.io/terms',
} as const;

export const EFFECTIVE_DATE = 'August 15, 2026';
export const DEVELOPER_NAME = 'Ojo Studio, LLC';
export const CONTACT_EMAIL  = 'support@ojoapp.io';
export const WEBSITE_URL    = 'https://www.ojoapp.io';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isPlaceholderUrl = (url: string) => url.startsWith('[') || url.includes('REPLACE_WITH');

export const shouldUseIframe = (url: string) => !isPlaceholderUrl(url);

// ─── Document content ─────────────────────────────────────────────────────────

export interface LegalSection {
  heading: string;
  subsections?: { heading: string; body: string[]; bullets?: string[] }[];
  body?: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title:    string;
  subtitle: string;
  url:      string;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title:    'Privacy Policy',
  subtitle: 'Ojo Wardrobe App',
  url:      LEGAL_URLS.privacyPolicy,
  sections: [
    {
      heading: '1. Introduction',
      body: [
        `Welcome to Ojo ("we," "our," or "us"). We are committed to protecting the privacy of every user of our mobile wardrobe application ("the App"). This Privacy Policy explains what personal information we collect, why we collect it, how we use and protect it, and what choices you have regarding your data.`,
        `By downloading or using the App, you agree to the collection and use of your information as described in this policy. If you do not agree, please do not use the App.`,
        `Developer / Data Controller: ${DEVELOPER_NAME} · Contact email: ${CONTACT_EMAIL} · Website: ${WEBSITE_URL}`,
      ],
    },
    {
      heading: '2. Information We Collect',
      subsections: [
        {
          heading: '2.1  Information You Provide Directly',
          body: ['When you create an account or use the App, you may provide:'],
          bullets: [
            'First and last name — used to personalise your account',
            'Email address — used to create and authenticate your account',
            'Password — if you sign up with email, your password is stored only as a salted cryptographic hash. We never store or have access to it in plain text. If you sign in with Apple or Google instead, no password is created',
            'Username — a display name of your choosing',
            'Date of birth — collected at sign-up to confirm you meet the minimum age requirement described in Section 9',
            'Location — either a city name you enter manually, or, if you choose "My Location," your device\'s GPS coordinates read on demand at that moment. The coordinates for the location you set are saved to your account so that scheduled notifications, such as your morning brief, can retrieve local weather while the App is closed. If you turn on Trip Mode, the App also reads your location on demand to detect when you have arrived at a saved trip destination. We do not track your location continuously or in the background, and we do not keep a history of where you have been',
            'Style preferences — your clothing style, temperature and humidity comfort thresholds, unit preferences, any additional cities you save, and — only if you choose to provide it — gender, which is used to tailor outfit suggestions',
            'Clothing item photos and metadata — images you upload or capture of your garments, plus descriptions, categories, colours, fabrics, and (optionally) merchant and purchase price',
            'Outfit wear history — records of which outfit suggestions you marked as "Wore this today," and the weather conditions at the time, which is what allows the App to learn your preferences',
            'Trip information (optional) — for trips you add, the airline, confirmation number, travel dates, origin/destination airports, and destination city, plus any outfit plans you build for them',
          ],
        },
        {
          heading: '2.2  Information Collected Automatically',
          body: ['When you use the App, we may automatically collect:'],
          bullets: [
            'Push notification token — a device-specific token used solely to deliver notifications you have enabled (e.g. morning brief, weather changes)',
            'Device information — device model, OS version, and app version',
            'Crash reports — error logs to help us identify and fix bugs',
          ],
        },
        {
          heading: '2.3  Information We Do NOT Collect',
          body: ['We do not collect financial or payment information, social media profiles, contacts, or biometric data of any kind. We do not track your location in the background, and we do not build an advertising profile about you — see the Location entry above for exactly how location is used.'],
        },
        {
          heading: '2.4  Photo Recognition Happens On Your Device',
          body: ['When you photograph a garment, the App identifies what it is — the garment type, its dominant colours, and a best-guess fabric — using a machine-learning model that runs entirely on your device. Your photo is not sent to us or to any third party for that recognition step. Images are uploaded to our image storage only so your closet is backed up and available across your devices, as described in Section 4.'],
        },
      ],
    },
    {
      heading: '3. How We Use Your Information',
      body: [
        'We use the information we collect solely to operate and improve the App: account creation and authentication; generating personalised outfit suggestions based on your closet, preferences, and local weather; remembering your style preferences and outfit history across sessions and devices; producing your wardrobe insights and weekly recap; identifying gaps in your closet relative to your local weather; populating the home-screen and lock-screen widgets; sending notifications you have enabled; powering the optional trip planner and Trip Mode; and diagnosing crashes.',
        'We do not use your data for advertising, and we do not sell your personal information to any third party.',
      ],
    },
    {
      heading: '4. How We Store and Protect Your Information',
      body: [
        'Your account data, closet metadata, outfit history, and trip information are stored in MongoDB Atlas, a cloud database service. The images of your clothing items are stored on Cloudflare R2, an object-storage service used as our image CDN; image filenames are random identifiers that contain no personal information. All data is transmitted over HTTPS/TLS encrypted connections, and access is limited to authorised systems.',
        'Passwords are never stored in readable form — only as a salted bcrypt hash. Authentication tokens are held in your device\'s secure storage (iOS Keychain / Android Keystore).',
        'If you add an Ojo widget to your home or lock screen, the App writes a small snapshot — today\'s outfit, the forecast, and thumbnail images — into a shared container on your device so the widget can render without a network call. That snapshot stays on your device and is removed when you delete the App.',
        'No method of electronic storage or transmission is 100% secure. If a breach occurs that is likely to affect your rights, we will notify you promptly.',
      ],
    },
    {
      heading: '5. Third-Party Services',
      body: ['The App uses a limited number of third-party services to function. Each service receives only the data needed to perform its role:'],
      bullets: [
        'MongoDB Atlas — cloud database used to store your account, closet metadata, outfit history, and trip information.',
        'Cloudflare R2 — object storage used to host the clothing item images you upload or capture. Images are served via CDN over HTTPS.',
        'Apple WeatherKit — receives the latitude/longitude resolved from the city you have set in order to return local weather conditions. Apple does not receive your account identifier. See https://weatherkit.apple.com/legal-attribution.html for the full list of data sources.',
        'Expo Push Notification Service — receives your device push token (and the contents of the notifications you have enabled) so it can deliver them to your device.',
        'Sign in with Apple (optional) — if you choose to sign in with Apple, Apple returns a stable identifier for your account and, on your first sign-in only, your name and email address. If you use Apple\'s "Hide My Email," we receive a private relay address instead of your real one, and that is all we ever see.',
        'Google Sign-In (optional) — if you choose to sign in with Google, Google returns your email address and basic profile information so we can create and authenticate your account. We do not request access to your Gmail, contacts, or any other Google data.',
        'Resend — transactional email provider used to deliver account emails such as password resets. It receives your email address and the contents of that message. We do not send marketing email.',
        'Open-Meteo — a free geocoding service used to power the city search box (e.g. when setting your default city or planning a trip). It receives the text you type and returns matching places with their coordinates. It does not receive your account identifier or any other information about you.',
        'Sentry — error and crash reporting. When the App or our API hits an error, Sentry receives the error itself, your device model, OS version, and app version, so we can find and fix it. We have switched off the features that would send more than that: it does not receive your IP address, it does not record your screen or your session, and it does not receive your console logs. It never receives your closet images, your outfit history, or the contents of your account.',
      ],
      subsections: [
        {
          heading: '5.1  Shopping Links',
          body: [
            'Where the App detects a gap in your wardrobe, it may offer a "Shop" link. Tapping it opens a Google Shopping search in your browser for a generic garment description such as "lightweight rain jacket." No account information, closet data, or identifier is included in that search, we receive nothing back from it, and we have no affiliate relationship with any merchant shown.',
          ],
        },
      ],
    },
    {
      heading: '6. Data Sharing and Disclosure',
      body: ['We do not sell, rent, or trade your personal information. We may disclose your information only in these limited circumstances:'],
      bullets: [
        'Service providers: Third-party vendors (MongoDB Atlas, Cloudflare R2, Apple WeatherKit, Expo Push, Resend, and — if you sign in with Apple or Google — Apple or Google) acting on our behalf under their published privacy and security terms.',
        'Legal compliance: If required by law, court order, or governmental authority.',
        'Safety: To protect the rights, property, or safety of our users or the public.',
        'Business transfer: If we merge with or are acquired by another company, with advance notice to you.',
      ],
    },
    {
      heading: '7. Data Retention',
      body: [
        'We retain your personal information for as long as your account is active. Account data and wardrobe data are kept until you delete your account. Individual outfit wear-history entries are automatically deleted three years after the date they were recorded — this history is what lets the App learn your preferences over multiple seasons. You can clear your wear history at any time from within the App without deleting your account.',
        'When you delete your account, your profile, closets, wear history, trips, and trip plans are erased immediately, and any remaining copies are removed within 30 days.',
      ],
    },
    {
      heading: '8. Your Privacy Rights',
      subsections: [
        {
          heading: '8.1  All Users',
          body: ['You may access, correct, or delete your data at any time within the App. To request a downloadable copy of your data, contact us at ' + CONTACT_EMAIL + '.'],
        },
        {
          heading: '8.2  California Residents (CCPA)',
          body: ['California residents have the right to know what personal information we collect, request its deletion, opt out of its sale (note: we do not sell data), and not be discriminated against for exercising these rights.'],
        },
      ],
    },
    {
      heading: '9. Children\'s Privacy',
      body: [
        `The App is not intended for children under the age of 13 and complies with the Children's Online Privacy Protection Act (COPPA). We do not knowingly collect personal information from children under 13.`,
        'We ask for your date of birth when you create an account, and we check it on our servers rather than only in the app. If you sign in with Apple or Google, neither service tells us your date of birth, so we ask you for it directly before the account can be used. Until we have it, the account cannot store or retrieve any of your information.',
        'If the date of birth given puts you under 13, the account and everything stored in it are deleted rather than kept.',
        `If you believe a child under 13 has provided us information under a different date of birth, contact us at ${CONTACT_EMAIL} and we will delete it promptly.`,
        'Users aged 13–17 may use the App with parental awareness.',
      ],
    },
    {
      heading: '10. Changes to This Privacy Policy',
      body: [
        'We may update this Privacy Policy from time to time. When we make material changes, we will update the Effective Date and notify you via in-app notification or email. Your continued use of the App after changes constitutes acceptance.',
      ],
    },
    {
      heading: '11. Contact Us',
      body: [
        `If you have any questions about this Privacy Policy, contact us at ${CONTACT_EMAIL}. We aim to respond within 30 calendar days.`,
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title:    'Terms of Service',
  subtitle: 'Ojo Wardrobe App',
  url:      LEGAL_URLS.termsOfService,
  sections: [
    {
      heading: '1. Acceptance of Terms',
      body: [
        `By accessing or using Ojo ("the App"), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. These Terms constitute a legally binding agreement between you and ${DEVELOPER_NAME}. If you do not agree, do not use the App.`,
        'We reserve the right to update these Terms at any time. Continued use of the App after changes take effect constitutes acceptance.',
      ],
    },
    {
      heading: '2. Description of the Service',
      body: [
        'Ojo is a free mobile wardrobe management application. It allows you to create and manage a digital wardrobe, receive outfit suggestions generated from your wardrobe and local weather conditions, and track your outfit wear history. Garment recognition from photos you take runs on your device using an on-device machine learning model.',
        'The App also provides wardrobe insights and a weekly recap, wardrobe gap detection, optional trip planning and packing lists, Trip Mode, home-screen and lock-screen widgets, and optional push notifications. Individual features may be added, changed, or removed over time.',
        'The App is provided free of charge with no paid features, subscriptions, or in-app purchases. We reserve the right to modify, suspend, or discontinue any part of the App at any time without liability.',
      ],
    },
    {
      heading: '3. Eligibility',
      body: ['You must be at least 13 years old to use the App. You must be a human user (automated access is prohibited). By using the App, you represent that you meet these requirements. Users aged 13–17 represent that their parent or guardian has reviewed and consented to these Terms.'],
    },
    {
      heading: '4. User Accounts',
      subsections: [
        {
          heading: '4.1  Account Creation',
          body: ['To use the App, you must create an account. You may do so with a valid email address, username, and password, or by using Sign in with Apple or Google Sign-In, in which case no separate password is created. You agree to provide accurate, current, and complete information.'],
        },
        {
          heading: '4.2  Account Security',
          body: ['You are solely responsible for maintaining the confidentiality of your credentials, including the Apple or Google account you use to sign in. Notify us immediately at ' + CONTACT_EMAIL + ' of any unauthorised use of your account.'],
        },
        {
          heading: '4.3  Account Termination',
          body: ['You may delete your account at any time from Account Settings. We reserve the right to suspend or terminate your account for violations of these Terms.'],
        },
      ],
    },
    {
      heading: '5. Acceptable Use',
      body: ['You agree NOT to: use the App for any unlawful purpose; attempt unauthorised access to the App or its servers; transmit malware or harmful code; scrape or use automated tools to extract data; reverse engineer any part of the App; harass or impersonate any person; upload illegal or infringing content; or circumvent security or rate-limiting measures.'],
    },
    {
      heading: '6. Intellectual Property',
      body: [
        `All content, features, and functionality of the App — including source code, UI, design, logos, and outfit suggestion algorithms — are owned by ${DEVELOPER_NAME} and protected by applicable intellectual property laws.`,
        'We grant you a limited, non-exclusive, non-transferable, revocable licence to use the App on your personal device solely for personal wardrobe management. This licence does not permit copying, modifying, or distributing the App.',
      ],
    },
    {
      heading: '7. User-Provided Content',
      body: [
        'You retain ownership of any clothing images and descriptions you upload ("User Content"). By uploading, you grant us a limited licence to store and display that content solely to provide the App\'s features to you.',
        'You represent that you own or have the rights to all User Content, that it does not infringe third-party rights, and that it does not contain illegal or harmful material.',
        'The App lets you share an outfit or donation list as an image to other apps, such as Instagram. Anything you choose to share that way leaves the App and becomes subject to the terms and privacy policy of the service you share it to. You decide what to share, and you are responsible for it once shared.',
      ],
    },
    {
      heading: '8. Third-Party Services and Links',
      body: [
        'The App relies on third-party services — including cloud hosting, image storage, weather data, push notification delivery, and email delivery — to function. Your use of the App is also subject to those providers\' terms, and we are not responsible for their availability or performance. Weather data is provided by Apple Weather and may be inaccurate or unavailable.',
        'Where the App identifies a gap in your wardrobe, it may offer a "Shop" link that opens a shopping search in your browser. Those results come from a third party. We do not endorse, verify, or take responsibility for any merchant, product, price, or listing shown, we receive no commission from them, and any purchase you make is solely between you and that merchant.',
      ],
    },
    {
      heading: '9. Disclaimers and Warranties',
      body: [
        'THE APP IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND. We do not warrant that the App will be uninterrupted or error-free, that outfit suggestions will meet your expectations, or that weather data will be accurate.',
        'Outfit recommendations are generated automatically and are provided for personal convenience only. They do not constitute professional styling advice.',
      ],
    },
    {
      heading: '10. Limitation of Liability',
      body: [
        `TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${DEVELOPER_NAME} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP.`,
        'In no event shall our total liability exceed $100 (as the App is currently free).',
      ],
    },
    {
      heading: '11. Indemnification',
      body: [`You agree to indemnify and hold harmless ${DEVELOPER_NAME} from any claims, liabilities, damages, and expenses arising from your use of the App, your violation of these Terms, or your User Content.`],
    },
    {
      heading: '12. Termination',
      body: [
        'Either party may terminate this agreement at any time. You may terminate by deleting your account. We may terminate by disabling your account for violations of these Terms. Upon termination your licence to use the App immediately ceases.',
      ],
    },
    {
      heading: '13. Governing Law and Dispute Resolution',
      body: [
        `These Terms are governed by the laws of the United States and the state in which ${DEVELOPER_NAME} is domiciled. Disputes shall first be submitted to informal resolution via email at ${CONTACT_EMAIL}. If unresolved, disputes shall be settled by binding arbitration under AAA rules. You waive any right to participate in a class-action lawsuit.`,
      ],
    },
    {
      heading: '14. Changes to These Terms',
      body: ['We may revise these Terms from time to time. When we make material changes, we will update the Effective Date and notify you via in-app notification or email.'],
    },
    {
      heading: '15. Miscellaneous',
      body: ['These Terms and our Privacy Policy constitute the entire agreement between you and us. If any provision is unenforceable, the remaining provisions continue in full force. Our failure to enforce any right does not constitute a waiver.'],
    },
    {
      heading: '16. Contact Us',
      body: [`If you have questions about these Terms, contact us at ${CONTACT_EMAIL}. We aim to respond within 30 calendar days.`],
    },
  ],
};
