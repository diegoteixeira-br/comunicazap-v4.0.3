import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Calendar, CreditCard, CheckCircle, AlertCircle, Crown, ExternalLink, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { STRIPE_PRODUCTS } from "@/config/stripeProducts";

const Subscription = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const subscription = useSubscription();
  const [loading, setLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const fetchSubscriptionData = async () => {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setSubscriptionData(data);
    };

    fetchSubscriptionData();
  }, [user]);

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Erro ao abrir portal:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao abrir portal: ${errorMessage.includes('No Stripe customer') ? 'Você ainda não possui assinatura ativa.' : 'Tente novamente em alguns instantes.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCheckout = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          price_id: STRIPE_PRODUCTS.premium.price_id
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success("Redirecionando para o checkout...");
      }
    } catch (error) {
      console.error('Erro ao criar checkout:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao criar checkout: ${errorMessage.includes('api_key') ? 'Problema com configuração do Stripe.' : errorMessage.includes('price') ? 'Produto não encontrado.' : 'Tente novamente.'}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusBadge = () => {
    if (subscription.loading) {
      return (
        <Badge variant="outline" className="animate-pulse">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Verificando...
        </Badge>
      );
    }
    
    if (subscription.trial_active) {
      return (
        <Badge variant="default" className="bg-blue-500 animate-fade-in">
          <AlertCircle className="h-3 w-3 mr-1" />
          Teste Grátis - {subscription.trial_days_left} dias restantes
        </Badge>
      );
    }
    
    if (subscription.subscribed) {
      return (
        <Badge variant="default" className="bg-green-500 animate-fade-in">
          <CheckCircle className="h-3 w-3 mr-1" />
          Ativa
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive" className="animate-fade-in">
        <AlertCircle className="h-3 w-3 mr-1" />
        Inativa
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Dashboard
        </Button>

        <div className="space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-3xl flex items-center gap-3">
                    <Crown className="h-8 w-8 text-primary" />
                    Minha Assinatura
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Gerencie sua assinatura e informações de pagamento
                  </CardDescription>
                </div>
                {getStatusBadge()}
              </div>
            </CardHeader>
          </Card>

          {/* Plan Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Detalhes do Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription.loading ? (
                <div className="space-y-4 animate-fade-in">
                  {/* Skeleton loader para plano atual */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="h-6 w-20 bg-muted rounded animate-pulse ml-auto" />
                      <div className="h-3 w-12 bg-muted rounded animate-pulse ml-auto" />
                    </div>
                  </div>

                  <Separator />

                  {/* Skeleton loader para próxima cobrança */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-40 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Skeleton loader para recursos */}
                  <div className="space-y-3">
                    <div className="h-4 w-36 bg-muted rounded animate-pulse" />
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-4 w-4 bg-muted rounded-full animate-pulse" />
                          <div className="h-3 w-64 bg-muted rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 animate-fade-in">
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Plano Atual</p>
                        <p className="text-sm text-muted-foreground">
                          {subscription.subscribed ? "ComunicaZap Premium" : 
                           subscription.trial_active ? "Teste Grátis (7 dias)" : "Nenhum plano ativo"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {subscription.subscribed && (
                        <p className="font-bold text-2xl text-primary">R$ 98,50</p>
                      )}
                      {subscription.trial_active && (
                        <p className="font-bold text-2xl text-blue-500">R$ 0,00</p>
                      )}
                      <p className="text-sm text-muted-foreground">/mês</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {subscription.trial_active ? "Fim do Período de Teste" : "Próxima Cobrança"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {subscription.trial_active 
                            ? formatDate(subscriptionData?.trial_ends_at)
                            : subscription.subscribed 
                              ? formatDate(subscriptionData?.current_period_end)
                              : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Features List */}
                  {subscription.has_access && (
                    <>
                      <Separator />
                      <div>
                        <p className="font-medium mb-3">Recursos Incluídos:</p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Importação automática de contatos do WhatsApp
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Pesquisa e filtro avançado de contatos
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Envio inteligente com delay aleatório para evitar bloqueios
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Histórico completo de campanhas
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Templates personalizáveis de mensagens
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Suporte prioritário via WhatsApp
                          </li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Ações</CardTitle>
              <CardDescription>
                Gerencie sua assinatura e forma de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {subscription.subscribed ? (
                <Button
                  onClick={handleManageSubscription}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {loading ? "Abrindo portal..." : "Gerenciar Assinatura no Stripe"}
                </Button>
              ) : (
                <Button
                  onClick={handleStartCheckout}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary to-accent"
                  size="lg"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  {loading ? "Carregando..." : 
                   subscription.trial_active ? "Assinar Plano Premium" : "Iniciar Teste Grátis"}
                </Button>
              )}
              
              {subscription.subscribed && (
                <p className="text-xs text-muted-foreground text-center">
                  Você será redirecionado para o portal seguro do Stripe onde poderá atualizar seu método de pagamento, 
                  visualizar faturas anteriores e cancelar sua assinatura se desejar.
                </p>
              )}

              {subscription.trial_active && !subscription.subscribed && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Seu período de teste termina em {subscription.trial_days_left} dias.</strong>
                    <br />
                    Para continuar usando após o período de teste, assine o plano premium.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Help */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardHeader>
              <CardTitle className="text-xl">Precisa de Ajuda?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Se você tiver dúvidas sobre sua assinatura ou precisar de suporte, 
                nossa equipe está pronta para ajudar.
              </p>
              <Button variant="outline" className="w-full">
                Falar com Suporte
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
