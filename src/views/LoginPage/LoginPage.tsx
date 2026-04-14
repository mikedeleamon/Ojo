import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import OjoLogo from '../../assets/images/logos/Ojo word logo 2.png';
import { AuthState } from '../../types';
import styles from './LoginPage.module.css';

const AUTH_KEY = 'ojo_auth';

interface Props { setLoggedIn: (v: boolean) => void; }

const LoginPage = ({ setLoggedIn }: Props) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post<AuthState & { settings: any }>('/api/auth/login', { email, password });
      localStorage.setItem(AUTH_KEY, JSON.stringify({ token: data.token, user: data.user }));
      setLoggedIn(true);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <img src={OjoLogo} alt='Ojo' className={styles.logo} />
        <p className={styles.tagline}>Dress for the weather.</p>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <input
              type='email'
              className={styles.input}
              placeholder='you@example.com'
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Password</span>
            <input
              type='password'
              className={styles.input}
              placeholder='••••••••'
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
        </div>

        <button className={styles.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className={styles.footer}>
          Don't have an account?{' '}
          <Link to='/signup' className={styles.link}>Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
