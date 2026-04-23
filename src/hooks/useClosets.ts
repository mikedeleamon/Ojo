import { useState, useEffect, useCallback } from 'react';
import axios from '../api/client';
import { Closet } from '../types';
import { auth, getToken } from '../lib/auth';
import { ArticleFormData } from '../components/ArticleModal/ArticleModal';

interface UseClosetsResult {
  closets:      Closet[];
  loading:      boolean;
  error:        string | null;
  preferred:    Closet | null;
  setClosets:   React.Dispatch<React.SetStateAction<Closet[]>>;
  createCloset: (name: string) => Promise<void>;
  renameCloset: (id: string, name: string) => Promise<void>;
  deleteCloset: (id: string) => Promise<void>;
  addArticle:   (closetId: string, data: ArticleFormData) => Promise<void>;
  editArticle:  (closetId: string, articleId: string, data: ArticleFormData) => Promise<void>;
  removeArticle:(closetId: string, articleId: string) => Promise<void>;
  setPreferred: (id: string) => Promise<void>;
}

/**
 * Fetches all closets for the authenticated user and exposes CRUD operations.
 * Replaces duplicated fetch+callback blocks in ClosetPage and OutfitSuggestion.
 */
export const useClosets = (): UseClosetsResult => {
  const [closets, setClosets] = useState<Closet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    axios.get<Closet[]>('/api/closets', auth())
      .then(({ data }) => setClosets(data))
      .catch(() => setError('Could not load closets. Is the server running?'))
      .finally(() => setLoading(false));
  }, []);

  const preferred = closets.find(c => c.isPreferred) ?? null;

  const patch = useCallback((id: string, updated: Closet) =>
    setClosets(prev => prev.map(c => c._id === id ? updated : c)), []);

  const createCloset = useCallback(async (name: string) => {
    const { data } = await axios.post<Closet>('/api/closets', { name }, auth());
    setClosets(prev => [data, ...prev]);
  }, []);

  const renameCloset = useCallback(async (id: string, name: string) => {
    const { data } = await axios.put<Closet>(`/api/closets/${id}`, { name }, auth());
    patch(id, data);
  }, [patch]);

  const deleteCloset = useCallback(async (id: string) => {
    await axios.delete(`/api/closets/${id}`, auth());
    setClosets(prev => prev.filter(c => c._id !== id));
  }, []);

  const addArticle = useCallback(async (closetId: string, formData: ArticleFormData) => {
    const { data } = await axios.post<Closet>(`/api/closets/${closetId}/articles`, formData, auth());
    patch(closetId, data);
  }, [patch]);

  const editArticle = useCallback(async (closetId: string, articleId: string, formData: ArticleFormData) => {
    const { data } = await axios.put<Closet>(`/api/closets/${closetId}/articles/${articleId}`, formData, auth());
    patch(closetId, data);
  }, [patch]);

  const removeArticle = useCallback(async (closetId: string, articleId: string) => {
    const { data } = await axios.delete<Closet>(`/api/closets/${closetId}/articles/${articleId}`, auth());
    patch(closetId, data);
  }, [patch]);

  const setPreferred = useCallback(async (id: string) => {
    const { data } = await axios.put<Closet>(`/api/closets/${id}/preferred`, {}, auth());
    setClosets(prev => prev.map(c => ({ ...c, isPreferred: c._id === data._id })));
  }, []);

  return { closets, loading, error, preferred, setClosets, createCloset, renameCloset,
           deleteCloset, addArticle, editArticle, removeArticle, setPreferred };
};
