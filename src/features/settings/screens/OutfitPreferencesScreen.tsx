import { useState } from 'react';
import ScreenShell from '../components/ScreenShell';
import { useSettings } from '../../../hooks/useSettings';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import styles from './screens.module.css';

const STYLES = [
    'Casual',
    'Business Casual',
    'Formal',
    'Athletic',
    'Urban',
    'Minimalist',
    'Urban',
    'Cozy',
    'Preppy',
];

const OutfitPreferencesScreen = () => {
    const { settings, saveSettings } = useSettings();
    const [style, setStyle] = useState(settings.clothingStyle);
    const { status, loading, submit } = useFormSubmit('Saved.', 2000);

    const save = () =>
        submit(() => saveSettings({ ...settings, clothingStyle: style }));

    return (
        <ScreenShell title='Outfit Preferences'>
            <div className={styles.section}>
                <p className={styles.sectionLabel}>Style</p>
                <div className={styles.chipGrid}>
                    {STYLES.map((s) => (
                        <button
                            key={s}
                            className={`${styles.chip} ${style === s ? styles.chipActive : ''}`}
                            onClick={() => setStyle(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <StatusMessage
                status={status}
                styles={styles}
            />
            <button
                className={styles.saveBtn}
                onClick={save}
                disabled={loading}
            >
                {loading ? 'Saving…' : 'Save'}
            </button>
        </ScreenShell>
    );
};

export default OutfitPreferencesScreen;
