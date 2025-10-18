import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/sessionClient';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Logout à prova de falhas: invalida no servidor, limpa local e força revalidação
    try {
      // 1) Tenta invalidar a sessão no servidor (pode falhar se já expirou)
      await supabase.auth.signOut({ scope: 'global' as any });
    } catch {
      // Ignora erros de sessão inexistente
    } finally {
      try {
        // 2) Garante que a sessão local seja removida
        await supabase.auth.signOut({ scope: 'local' as any });
      } catch {}

      // 3) Limpa chaves residuais do Supabase no localStorage/sessionStorage
      try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith('sb-') || k.toLowerCase().includes('supabase')) {
            localStorage.removeItem(k);
          }
        }
      } catch {}
      try { sessionStorage.clear(); } catch {}

      // 4) Atualiza estado imediatamente
      setUser(null);
      setSession(null);
      setLoading(false);
    }
  };

  return { user, session, loading, signOut };
};