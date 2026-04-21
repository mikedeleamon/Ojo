import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import OjoLogo from '../../assets/images/logos/Ojo word logo 2.png';
import { AuthState, Settings } from '../../types';
import { getErrorMessage, saveAuth } from '../../lib/auth';
import { View, Text, TextInput, Pressable, Image } from '../../components/primitives';
import styles from './LoginPage.module.css';

interface Props { setLoggedIn: (v: boolean) => void; }

const LoginPage = ({ setLoggedIn }: Props) => {
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError(null);
    if (!identifier || !password) {
      setError('Please enter your email or username, and your password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post<AuthState & { settings: Settings }>(
        '/api/auth/login',
        { identifier, password },
      );
      await saveAuth(data.token, data.user);
      setLoggedIn(true);
      navigate('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Image source={{ uri: OjoLogo }} style={styles.logo} accessibilityLabel="Ojo" resizeMode="contain" />
        <Text style={styles.tagline}>Dress for the weather.</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.fields}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email or username</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com or @janedoe"
              value={identifier}
              onChangeText={setIdentifier}
              onSubmitEditing={handleSubmit}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
            />
          </View>
        </View>

        <Pressable style={styles.btn} onPress={handleSubmit} disabled={loading}>
          <Text>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        {/* Link uses React Router — RN migration: replace with navigation.navigate('Signup') */}
        <Text style={styles.footer}>
          Don't have an account?{' '}
          <Link to="/signup" className={styles.link}>Sign up</Link>
        </Text>
      </View>
    </View>
  );
};

export default LoginPage;
