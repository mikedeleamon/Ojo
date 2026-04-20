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
  privacyPolicy:   '[REPLACE_WITH_HOSTED_URL]/privacy',
  termsOfService:  '[REPLACE_WITH_HOSTED_URL]/terms',
} as const;

export const EFFECTIVE_DATE = '[EFFECTIVE DATE]';
export const DEVELOPER_NAME = '[DEVELOPER NAME]';
export const CONTACT_EMAIL  = '[CONTACT EMAIL]';
export const WEBSITE_URL    = '[WEBSITE URL]';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isPlaceholderUrl = (url: string) => url.startsWith('[') || url.includes('REPLACE_WITH');

export const shouldUseIframe = (url: string) => !isPlaceholderUrl(url);

// ─── Document content ─────────────────────────────────────────────────────────

export interface LegalSection {
  heading: string;
  subsections?: { heading: string; body: string[] }[];
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
        },
        {
          heading: '2.2  Information Collected Automatically',
          body: ['When you use the App, we may automatically collect:'],
        },
        {
          heading: '2.3  Information We Do NOT Collect',
          body: ['We do not collect financial or payment information, real-time GPS location, social media profiles, or biometric data of any kind.'],
        },
      ],
      bullets: [
        'Email address — used to create and authenticate your account',
        'Username — a display name of your choosing',
        'Location (city name) — entered manually to retrieve local weather data for outfit suggestions',
        'Clothing and wardrobe data — descriptions, categories, colours, fabrics, and images of clothing items',
        'Outfit wear history — records of which outfit suggestions you marked as "Wore this today"',
        'Device information — device model, OS version, and app version',
        'Usage analytics — feature interactions and session duration (aggregated and anonymised)',
        'Crash reports — error logs to help us identify and fix bugs',
      ],
    },
    {
      heading: '3. How We Use Your Information',
      body: [
        'We use the information we collect solely to operate and improve the App: account creation and authentication; generating personalised outfit suggestions based on your closet, preferences, and local weather; remembering your style preferences and outfit history across sessions; and diagnosing crashes.',
        'We do not use your data for advertising, and we do not sell your personal information to any third party.',
      ],
    },
    {
      heading: '4. How We Store and Protect Your Information',
      body: [
        'Your account data, closets, and clothing articles are stored in MongoDB Atlas, a cloud database service. All data is transmitted over HTTPS/TLS encrypted connections. We implement access controls limiting database access to authorised systems only.',
        'No method of electronic storage or transmission is 100% secure. If a breach occurs that is likely to affect your rights, we will notify you promptly.',
      ],
    },
    {
      heading: '5. Third-Party Services',
      body: ['The App uses a limited number of third-party services to function:'],
      bullets: [
        'AccuWeather API — used to retrieve weather conditions for your specified city. Your city name is sent to AccuWeather to fetch local weather data.',
        'MongoDB Atlas — cloud database provider used to store your account and wardrobe data.',
      ],
    },
    {
      heading: '6. Data Sharing and Disclosure',
      body: ['We do not sell, rent, or trade your personal information. We may disclose your information only in these limited circumstances:'],
      bullets: [
        'Service providers: Third-party vendors (e.g., MongoDB Atlas) under strict confidentiality obligations.',
        'Legal compliance: If required by law, court order, or governmental authority.',
        'Safety: To protect the rights, property, or safety of our users or the public.',
        'Business transfer: If we merge with or are acquired by another company, with advance notice to you.',
      ],
    },
    {
      heading: '7. Data Retention',
      body: [
        'We retain your personal information for as long as your account is active. Account data and wardrobe data are kept until you delete your account. Outfit wear history is retained for up to 12 months. When you delete your account, all personally identifiable data is permanently removed within 30 days.',
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
        `The App is not intended for children under the age of 13 and complies with the Children's Online Privacy Protection Act (COPPA). We do not knowingly collect personal information from children under 13. If you believe your child has provided us information, contact us at ${CONTACT_EMAIL} and we will delete it promptly.`,
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
        'Ojo is a free mobile wardrobe management application that allows users to create and manage a digital wardrobe, receive AI-generated outfit suggestions based on their wardrobe and local weather conditions, and track outfit wear history.',
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
          body: ['To use the App, you must create an account with a valid email address, username, and password. You agree to provide accurate, current, and complete information.'],
        },
        {
          heading: '4.2  Account Security',
          body: ['You are solely responsible for maintaining the confidentiality of your credentials. Notify us immediately at ' + CONTACT_EMAIL + ' of any unauthorised use of your account.'],
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
      ],
    },
    {
      heading: '8. Disclaimers and Warranties',
      body: [
        'THE APP IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND. We do not warrant that the App will be uninterrupted or error-free, that outfit suggestions will meet your expectations, or that weather data will be accurate.',
        'Outfit recommendations are generated automatically and are provided for personal convenience only. They do not constitute professional styling advice.',
      ],
    },
    {
      heading: '9. Limitation of Liability',
      body: [
        `TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${DEVELOPER_NAME} SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP.`,
        'In no event shall our total liability exceed $100 (as the App is currently free).',
      ],
    },
    {
      heading: '10. Indemnification',
      body: [`You agree to indemnify and hold harmless ${DEVELOPER_NAME} from any claims, liabilities, damages, and expenses arising from your use of the App, your violation of these Terms, or your User Content.`],
    },
    {
      heading: '11. Termination',
      body: [
        'Either party may terminate this agreement at any time. You may terminate by deleting your account. We may terminate by disabling your account for violations of these Terms. Upon termination your licence to use the App immediately ceases.',
      ],
    },
    {
      heading: '12. Governing Law and Dispute Resolution',
      body: [
        `These Terms are governed by the laws of the United States and the state in which ${DEVELOPER_NAME} is domiciled. Disputes shall first be submitted to informal resolution via email at ${CONTACT_EMAIL}. If unresolved, disputes shall be settled by binding arbitration under AAA rules. You waive any right to participate in a class-action lawsuit.`,
      ],
    },
    {
      heading: '13. Changes to These Terms',
      body: ['We may revise these Terms from time to time. When we make material changes, we will update the Effective Date and notify you via in-app notification or email.'],
    },
    {
      heading: '14. Miscellaneous',
      body: ['These Terms and our Privacy Policy constitute the entire agreement between you and us. If any provision is unenforceable, the remaining provisions continue in full force. Our failure to enforce any right does not constitute a waiver.'],
    },
    {
      heading: '15. Contact Us',
      body: [`If you have questions about these Terms, contact us at ${CONTACT_EMAIL}. We aim to respond within 30 calendar days.`],
    },
  ],
};
