import { useState } from 'react';
import ScreenShell from '../components/ScreenShell';
import { useSettings } from '../../../hooks/useSettings';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import styles from './screens.module.css';

const LocationScreen = () => {
  const { settings, saveSettings }  = useSettings();
  const [city, setCity]             = useState(settings.location);
  const { status, loading, submit } = useFormSubmit('Location saved.', 2000);

  const save = () => submit(() => saveSettings({ ...settings, location: city.trim() }));

  return (
    <ScreenShell title="Location">
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Default city</p>
        <p className={styles.hint}>
          Used to fetch local weather for outfit suggestions. Enter a city name
          (e.g. "New York" or "London").
        </p>
        <input
          className={styles.input}
          type="text"
          placeholder="City name"
          value={city}
          onChange={e => setCity(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); }}
        />
      </div>

      <StatusMessage status={status} styles={styles} />
      <button className={styles.saveBtn} onClick={save} disabled={loading}>
        {loading ? 'Saving…' : 'Save'}
      </button>
    </ScreenShell>
  );
};

export default LocationScreen;
