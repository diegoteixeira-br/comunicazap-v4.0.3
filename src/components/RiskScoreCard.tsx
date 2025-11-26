import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";

interface RiskScoreCardProps {
  contactCount: number;
  dailyLimit: number;
  alreadySentToday: number;
}

export const RiskScoreCard = ({ contactCount, dailyLimit, alreadySentToday }: RiskScoreCardProps) => {
  const remainingToday = dailyLimit - alreadySentToday;
  const willSend = Math.min(contactCount, remainingToday);
  
  // Calculate risk level
  const getRiskLevel = () => {
    if (willSend <= 30) return "low";
    if (willSend <= 50) return "medium";
    return "high";
  };

  const riskLevel = getRiskLevel();

  const riskConfig = {
    low: {
      icon: CheckCircle,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
      title: "🟢 Risco Baixo",
      description: "Seguro para envio. Volume dentro dos limites recomendados."
    },
    medium: {
      icon: AlertCircle,
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
      borderColor: "border-yellow-200 dark:border-yellow-800",
      title: "🟡 Risco Médio",
      description: "Considere dividir em 2 lotes ou aguardar até amanhã para parte dos envios."
    },
    high: {
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-200 dark:border-red-800",
      title: "🔴 Risco Alto",
      description: "ATENÇÃO! Volume alto pode resultar em bloqueio. Divida em múltiplos dias."
    }
  };

  const config = riskConfig[riskLevel];
  const Icon = config.icon;

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2 shadow-elevated`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.color}`} />
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert className={`${config.bgColor} ${config.borderColor}`}>
          <AlertDescription className="text-sm">
            {config.description}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Envios hoje:</p>
            <p className="font-bold text-lg">{alreadySentToday}/{dailyLimit}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Disponíveis:</p>
            <p className={`font-bold text-lg ${remainingToday <= 10 ? 'text-destructive' : ''}`}>
              {remainingToday}
            </p>
          </div>
        </div>

        {contactCount > remainingToday && (
          <Alert className="bg-destructive/10 border-destructive/20">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Você selecionou {contactCount} contatos, mas só pode enviar {remainingToday} hoje.
              Apenas os primeiros {remainingToday} serão enviados.
            </AlertDescription>
          </Alert>
        )}

        {riskLevel === "high" && (
          <div className="text-xs space-y-1 text-muted-foreground">
            <p>💡 <strong>Dica:</strong> Divida em lotes de 30-40 contatos por dia</p>
            <p>🔒 <strong>Segurança:</strong> Envios graduais evitam bloqueios do WhatsApp</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
