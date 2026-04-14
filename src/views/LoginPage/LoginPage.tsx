import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import OjoLogo from '../../assets/images/logos/Ojo word logo 2.png';
import styles from './LoginPage.module.css';

interface Props { setLoggedIn: (v: boolean) => void; }

const LoginPage = ({ setLoggedIn }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => {
    setLoggedIn(true);
    navigate('/');
  };

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <img src={OjoLogo} alt='Ojo' className={styles.logo} />
        <p className={styles.tagline}>Dress for the weather.</p>

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

        <button className={styles.btn} onClick={handleSubmit}>Sign in</button>

        <p className={styles.footer}>
          Don't have an account?{' '}
          <Link to='/signup' className={styles.link}>Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
