import axios from 'axios';

// Normalize base: use REACT_APP_SERVER_BASE in dev if set, otherwise empty (relative URLs).
const rawBase = process.env.REACT_APP_SERVER_BASE ?? '';
// Remove trailing slash to avoid double slashes when joining with paths that start with '/'
// Use a simple replace without the 'u' flag for compatibility with older TS targets
const base = rawBase.replace(/\/+$/g, '');

const client = axios.create({
  baseURL: base,
  // Do not send cookies by default from the client; server routes should not require them.
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

export default client;
