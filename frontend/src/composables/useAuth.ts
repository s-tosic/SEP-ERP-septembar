import { ref, computed } from 'vue';
import { api } from './useApi';
import { User } from '../types';

const currentUser = ref<User | null>(null);
const authToken = ref<string | null>(localStorage.getItem('sep_mm_token'));

// Inicijalizacija korisnika iz localStorage pri osvežavanju stranice
const storedUser = localStorage.getItem('sep_mm_user');
if (storedUser) {
  try {
    currentUser.value = JSON.parse(storedUser);
  } catch (e) {
    currentUser.value = null;
  }
}

export function useAuth() {
  const isAuthenticated = computed(() => !!authToken.value && !!currentUser.value);
  const isAdmin = computed(() => currentUser.value?.role === 'ADMIN');

  async function login(email: string, password: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data.success) {
        authToken.value = response.data.token;
        currentUser.value = response.data.user;

        localStorage.setItem('sep_mm_token', response.data.token);
        localStorage.setItem('sep_mm_user', JSON.stringify(response.data.user));

        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data.message || 'Neuspešna prijava.' };
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Greška pri povezivanju sa serverom.';
      return { success: false, message: msg };
    }
  }

  async function register(
    name: string,
    email: string,
    password: string,
    role: 'ADMIN' | 'MAGACIONER' = 'MAGACIONER'
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      if (response.data.success) {
        authToken.value = response.data.token;
        currentUser.value = response.data.user;

        localStorage.setItem('sep_mm_token', response.data.token);
        localStorage.setItem('sep_mm_user', JSON.stringify(response.data.user));

        return { success: true, message: response.data.message };
      }
      return { success: false, message: response.data.message || 'Neuspešna registracija.' };
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Greška pri registraciji naloga.';
      return { success: false, message: msg };
    }
  }

  function logout() {
    authToken.value = null;
    currentUser.value = null;
    localStorage.removeItem('sep_mm_token');
    localStorage.removeItem('sep_mm_user');
  }

  return {
    user: currentUser,
    token: authToken,
    isAuthenticated,
    isAdmin,
    login,
    register,
    logout,
  };
}
