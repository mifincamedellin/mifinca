import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().min(2),
  farmName: z.string().min(2),
});

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;

// Mocking auth operations since they aren't fully defined in the OpenAPI schema
// In a real scenario, this connects to /api/auth/login and /api/auth/register
export function useAuth() {
  const setToken = useStore(state => state.setToken);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: async (data: LoginData) => {
      // MOCK IMPLEMENTATION since endpoints are missing in spec
      // Replace with actual fetch when backend is ready
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        // Mock fallback for demonstration purposes if endpoint doesn't exist
        if (res.status === 404) {
          console.warn("Auth endpoint not found, mocking success...");
          return { token: "mock_jwt_token_123" };
        }
        throw new Error('Failed to login');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.invalidateQueries();
      setLocation('/dashboard');
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Credenciales inválidas." });
    }
  });

  const register = useMutation({
    mutationFn: async (data: RegisterData) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          console.warn("Auth endpoint not found, mocking success...");
          return { token: "mock_jwt_token_123" };
        }
        throw new Error('Failed to register');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.invalidateQueries();
      toast({ title: "Cuenta creada", description: "Tu cuenta ha sido creada exitosamente." });
      setLocation('/dashboard');
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear la cuenta." });
    }
  });

  return { login, register };
}
