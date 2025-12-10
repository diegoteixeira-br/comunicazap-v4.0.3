import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-muted border-t mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Coluna 1: Sobre a Empresa */}
          <div>
            <a
              href="https://dtsolucoesdigital.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold mb-4 hover:text-primary transition-colors inline-block"
            >
              DT Soluções Digital
            </a>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Uma plataforma de automação inteligente para suas campanhas de marketing no WhatsApp. Conecte-se com seus
              clientes de forma eficaz e profissional.
            </p>
          </div>

          {/* Coluna 2: Links Rápidos */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Plataforma</h3>
            <nav className="flex flex-col space-y-2">
              <a href="/#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Início
              </a>
              <a href="/#how-it-works" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Funcionalidades
              </a>
              <a href="/#pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Preços
              </a>
            </nav>
          </div>

          {/* Coluna 3: Contato e Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Informações</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a
                href="https://dtsolucoesdigital.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline font-medium"
              >
                🌐 dtsolucoesdigital.com.br
              </a>
              <p>
                <strong>Razão Social:</strong> DT Soluções Digital - MEI
              </p>
              <p>
                <strong>CNPJ:</strong> 63.266.334/0001-21
              </p>
              <p>
                <strong>Endereço:</strong> Rua F. V de Azevedo, 07 Bairro: Cohab Nova Cidade: Cáceres-MT
              </p>
              <a
                href="mailto:contato@dtsolucoesdigital.com.br"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                contato@dtsolucoesdigital.com.br
              </a>
              <a href="tel:[telefone]" className="flex items-center gap-2 hover:text-primary transition-colors">
                <Phone className="h-4 w-4" />
                (65) 99302-5105
              </a>
            </div>
          </div>
        </div>

        {/* Linha Inferior */}
        <div className="border-t pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">© 2025 DT Soluções Digital. Todos os direitos reservados.</p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                Termos de Serviço
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                Política de Privacidade
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link to="/refund-policy" className="text-muted-foreground hover:text-primary transition-colors">
                Política de Reembolso
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
