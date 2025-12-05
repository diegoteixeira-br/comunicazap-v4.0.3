import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

export const ForceLightTheme = ({ children }: { children: React.ReactNode }) => {
  const { setTheme } = useTheme();
  const savedTheme = useRef<string | null>(null);

  useEffect(() => {
    // Salvar a preferência DIRETAMENTE do localStorage antes de modificar
    savedTheme.current = localStorage.getItem("theme");
    
    // Forçar tema light nas páginas públicas
    setTheme("light");

    return () => {
      // Quando sair da página pública, restaurar a preferência original
      if (savedTheme.current) {
        setTheme(savedTheme.current);
      }
    };
  }, [setTheme]);

  return <>{children}</>;
};
