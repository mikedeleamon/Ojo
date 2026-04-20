import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import OjoLogo from '../../assets/images/logos/Ojo word logo 2.png';
import { formatDate } from '../../helpers/formatTools.js';
import { AUTH_KEY, getErrorMessage } from '../../lib/auth';
import styles from './SignupPage.module.css';

interface Props {
  setLoggedIn: (v: boolean) => void;
  setNeedsOnboarding: (v: boolean) => void;
}

const Field = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <label className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    <input className={styles.input} {...props} />
  </label>
);

const SignupPage = ({ setLoggedIn, setNeedsOnboarding }: Props) => {
  const [form, setForm] = useState({
    firstName: '', lastName: '', birthday: '',
    email: '', username: '', password: '', passwordConfirmation: '',
  });
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const onSubmit = async () => {
    setError(null);
    if (form.password !== form.passwordConfirmation) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/signup', {
        firstName: form.firstName,
        lastName:  form.lastName,
        username:  form.username,
        email:     form.email,
        password:  form.password,
        birthday:  form.birthday,
      });
      localStorage.setItem(AUTH_KEY, JSON.stringify({ token: data.token, user: data.user }));
      setNeedsOnboarding(true);
      setLoggedIn(true);
      navigate('/onboarding');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Sign up failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <Link to='/login' className={styles.backBtn} aria-label='Back'>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>

        <img src={OjoLogo} alt='Ojo' className={styles.logo} />
        <h1 className={styles.heading}>Create account</h1>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.fields}>
          <div className={styles.row}>
            <Field label='First name' type='text' placeholder='Jane' value={form.firstName} onChange={set('firstName')} />
            <Field label='Last name'  type='text' placeholder='Doe'  value={form.lastName}  onChange={set('lastName')} />
          </div>
          <Field label='Date of birth' type='text' placeholder='MM/DD/YYYY' value={form.birthday}
            onChange={e => setForm(f => ({ ...f, birthday: formatDate(e) }))} />
          <Field label='Email'    type='email' placeholder='you@example.com' value={form.email}    onChange={set('email')} />
          <Field label='Username' type='text'  placeholder='@janedoe'        value={form.username} onChange={set('username')} />
          <Field label='Password'         type='password' placeholder='••••••••' value={form.password}             onChange={set('password')} />
          <Field label='Confirm password' type='password' placeholder='••••••••' value={form.passwordConfirmation} onChange={set('passwordConfirmation')} />
        </div>

        <button className={styles.btn} onClick={onSubmit} disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link to='/login' className={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
