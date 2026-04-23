import { useState, useEffect } from 'react';

import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { useSettings } from '../../../hooks/useSettings';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import styles from '../../../views/SettingsPage/SettingsPage.module.css';
import ScreenShell from '../components/ScreenShell';
const STYLES = [
    'Casual',
    'Business Casual',
    'Formal',
    'Urban',
    'Cozy',
    'Preppy',
];

interface Props {
    embedded?: boolean;
}

const PreferencesScreen = ({ embedded }: Props) => {
    const nav = useAppNavigation();
    const { settings, saveSettings, settingsReady } = useSettings();

    const [clothingStyle, setClothingStyle] = useState(settings.clothingStyle);
    const [location, setLocation] = useState(settings.location);
    const [tempScale, setTempScale] = useState<'Imperial' | 'Metric'>(
        settings.temperatureScale as 'Imperial' | 'Metric',
    );
    const [hiTemp, setHiTemp] = useState(settings.hiTempThreshold);
    const [lowTemp, setLowTemp] = useState(settings.lowTempThreshold);
    const [humidity, setHumidity] = useState(settings.humidityPreference);

    // Sync local state once settings have loaded from cache / server.
    // useState only captures the initial value on first render — without this,
    // fields stay on defaults if settings aren't ready when the screen mounts.
    useEffect(() => {
        if (!settingsReady) return;
        setClothingStyle(settings.clothingStyle);
        setLocation(settings.location);
        setTempScale(settings.temperatureScale as 'Imperial' | 'Metric');
        setHiTemp(settings.hiTempThreshold);
        setLowTemp(settings.lowTempThreshold);
        setHumidity(settings.humidityPreference);
    }, [settingsReady]); // eslint-disable-line react-hooks/exhaustive-deps

    const { status, loading, submit } = useFormSubmit(
        'Preferences saved.',
        2500,
    );

    const save = () =>
        submit(() =>
            saveSettings({
                clothingStyle,
                location,
                temperatureScale: tempScale,
                hiTempThreshold: hiTemp,
                lowTempThreshold: lowTemp,
                humidityPreference: humidity,
            }),
        );

    return (
        <ScreenShell
            title='Preferences'
            embedded={embedded}
        >
            <StatusMessage
                status={status}
                styles={styles}
            />
            <div className={styles.sections}>
                {/* Clothing style */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Style preference</h2>
                    <div className={styles.chips}>
                        {STYLES.map((s) => (
                            <button
                                key={s}
                                className={`${styles.chip} ${clothingStyle === s ? styles.chipActive : ''}`}
                                onClick={() => setClothingStyle(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Location */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Default location</h2>
                    <input
                        className={styles.input}
                        type='text'
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder='City name'
                    />
                </section>

                {/* Temperature unit */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Temperature unit</h2>
                    <div className={styles.segmented}>
                        <button
                            className={`${styles.seg} ${tempScale === 'Imperial' ? styles.segActive : ''}`}
                            onClick={() => setTempScale('Imperial')}
                        >
                            °F
                        </button>
                        <button
                            className={`${styles.seg} ${tempScale === 'Metric' ? styles.segActive : ''}`}
                            onClick={() => setTempScale('Metric')}
                        >
                            °C
                        </button>
                    </div>
                </section>

                {/* Temperature thresholds */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Temperature feel</h2>
                    <SliderField
                        label='Hot above'
                        value={hiTemp}
                        unit='°'
                        min={50}
                        max={120}
                        onChange={setHiTemp}
                    />
                    <SliderField
                        label='Cold below'
                        value={lowTemp}
                        unit='°'
                        min={0}
                        max={70}
                        onChange={setLowTemp}
                    />
                </section>

                {/* Humidity */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        Humidity sensitivity
                    </h2>
                    <SliderField
                        label='Threshold'
                        value={humidity}
                        unit='%'
                        min={0}
                        max={100}
                        onChange={setHumidity}
                    />
                </section>
            </div>
            <button
                className={styles.saveBtn}
                onClick={save}
                disabled={loading}
            >
                {loading ? 'Saving…' : 'Save changes'}
            </button>
        </ScreenShell>
    );
};

const SliderField = ({
    label,
    value,
    unit,
    min,
    max,
    onChange,
}: {
    label: string;
    value: number;
    unit: string;
    min: number;
    max: number;
    onChange: (v: number) => void;
}) => (
    <div className={styles.sliderRow}>
        <div className={styles.sliderMeta}>
            <span className={styles.sliderLabel}>{label}</span>
            <span className={styles.sliderValue}>
                {value}
                {unit}
            </span>
        </div>
        <input
            type='range'
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className={styles.slider}
        />
    </div>
);

export default PreferencesScreen;
