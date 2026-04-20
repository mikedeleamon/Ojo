import { useState, useCallback } from 'react';
import { LegalDocument, shouldUseIframe, EFFECTIVE_DATE } from '../../config/legal';
import styles from './LegalModal.module.css';

interface Props {
  doc:     LegalDocument;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

const LegalModal = ({ doc, onClose }: Props) => {
  const useIframe           = shouldUseIframe(doc.url);
  const [state, setState]   = useState<LoadState>(useIframe ? 'loading' : 'ready');

  const handleLoad  = useCallback(() => setState('ready'), []);
  const handleError = useCallback(() => setState('error'), []);
  const handleRetry = useCallback(() => { setState('loading'); }, []);

  // Close on backdrop click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label={doc.title}>
      <div className={styles.modal}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.headerTitle}>{doc.title}</span>
            <span className={styles.headerSub}>{doc.subtitle} · Effective: {EFFECTIVE_DATE}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>

          {/* iframe path — used when real URLs are configured */}
          {useIframe && (
            <>
              {state === 'loading' && (
                <div className={styles.loadingState}>
                  <div className={styles.spinner} aria-label="Loading" />
                  <span>Loading document…</span>
                </div>
              )}
              {state === 'error' && (
                <div className={styles.errorState}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>Unable to load document.</p>
                  <button className={styles.retryBtn} onClick={handleRetry}>Retry</button>
                </div>
              )}
              <iframe
                src={doc.url}
                title={doc.title}
                className={`${styles.iframe} ${state === 'ready' ? styles.iframeVisible : ''}`}
                onLoad={handleLoad}
                onError={handleError}
              />
            </>
          )}

          {/* Inline path — used until real URLs are configured */}
          {!useIframe && (
            <InlineContent doc={doc} />
          )}
        </div>

      </div>
    </div>
  );
};

// ─── Inline renderer ──────────────────────────────────────────────────────────

const InlineContent = ({ doc }: { doc: LegalDocument }) => (
  <article className={styles.inline}>
    <h1 className={styles.inlineTitle}>{doc.title}</h1>
    <p className={styles.inlineMeta}>
      {doc.subtitle} &nbsp;·&nbsp; Effective: {EFFECTIVE_DATE}
    </p>
    <hr className={styles.inlineDivider} />

    {doc.sections.map((section) => (
      <section key={section.heading} className={styles.section}>
        <h2 className={styles.sectionHeading}>{section.heading}</h2>

        {section.body?.map((para, i) => (
          <p key={i} className={styles.para}>{para}</p>
        ))}

        {section.bullets && (
          <ul className={styles.bullets}>
            {section.bullets.map((item, i) => (
              <li key={i} className={styles.bulletItem}>{item}</li>
            ))}
          </ul>
        )}

        {section.subsections?.map((sub) => (
          <div key={sub.heading} className={styles.subsection}>
            <h3 className={styles.subsectionHeading}>{sub.heading}</h3>
            {sub.body.map((para, i) => (
              <p key={i} className={styles.para}>{para}</p>
            ))}
          </div>
        ))}
      </section>
    ))}
  </article>
);

export default LegalModal;
