import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/sessionClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MessageLog {
  id: string;
  client_name: string;
  client_phone: string;
  message: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface Campaign {
  id: string;
  campaign_name: string;
  status: string;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  message_variations: string[];
}

interface CampaignDetailsDialogProps {
  campaign: Campaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CampaignDetailsDialog = ({ campaign, open, onOpenChange }: CampaignDetailsDialogProps) => {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && campaign) {
      fetchLogs();
    }
  }, [open, campaign]);

  const fetchLogs = async () => {
    if (!campaign) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('message_logs')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false });

    if (data) {
      setLogs(data);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      sent: { className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400', label: 'Enviado' },
      failed: { className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400', label: 'Falhou' },
      pending: { className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400', label: 'Pendente' },
    };

    const statusConfig = config[status] || config.pending;
    
    return (
      <Badge variant="outline" className={statusConfig.className}>
        {getStatusIcon(status)}
        <span className="ml-1">{statusConfig.label}</span>
      </Badge>
    );
  };

  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="truncate">{campaign.campaign_name}</span>
          </DialogTitle>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground pt-2">
            <span>Total: <strong className="text-foreground">{campaign.total_contacts}</strong></span>
            <span>Enviados: <strong className="text-green-600">{campaign.sent_count}</strong></span>
            <span>Falhas: <strong className="text-destructive">{campaign.failed_count}</strong></span>
            <span>Data: {format(new Date(campaign.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}</span>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum registro encontrado
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{log.client_name || 'Sem nome'}</span>
                        <span className="text-xs text-muted-foreground">{log.client_phone}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {log.message}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {log.error_message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {getStatusBadge(log.status || 'pending')}
                      {log.sent_at && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.sent_at), 'HH:mm', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
