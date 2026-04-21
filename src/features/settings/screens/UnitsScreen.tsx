import { useState } from 'react';
import ScreenShell from '../components/ScreenShell';
import { useSettings } from '../../../hooks/useSettings';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import styles from './screens.module.css';

const UnitsScreen = () => {
  const { settings, saveSettings }  = useSettings();
  const [scale, setScale] = useState<'Imperial' | 'Metric'>(
    settings.temperatureScale as 'Imperial' | 'Metric'
  );
  const { status, loading, submit } = useFormSubmit('Units updated.', 2000);

  const save = () => submit(() => saveSettings({ ...settings, temperatureScale: scale }));

  return (
    <ScreenShell title="Units">
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Temperature</p>
        <div className={styles.segmented}>
          <button
            className={`${styles.seg} ${scale === 'Imperial' ? styles.segActive : ''}`}
            onClick={() => setScale('Imperial')}>
            °F — Fahrenheit
          </button>
          <button
            className={`${styles.seg} ${scale === 'Metric' ? styles.segActive : ''}`}
            onClick={() => setScale('Metric')}>
            °C — Celsius
          </button>
        </div>
      </div>

      <StatusMessage status={status} styles={styles} />
      <button className={styles.saveBtn} onClick={save} disabled={loading}>
        {loading ? 'Saving…' : 'Save'}
      </button>
    </ScreenShell>
  );
};

export default UnitsScreen;
