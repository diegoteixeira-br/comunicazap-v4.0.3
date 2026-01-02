import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/sessionClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Loader2, Pause, Play, X, Eye, Clock, Send, CalendarClock, Lock, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CampaignDetailsDialog } from '@/components/CampaignDetailsDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [campaignToCancel, setCampaignToCancel] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Reschedule state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [campaignToReschedule, setCampaignToReschedule] = useState<any>(null);
  const [newScheduledDate, setNewScheduledDate] = useState<Date>();
  const [newScheduledTime, setNewScheduledTime] = useState("12:00");
  const [isRescheduling, setIsRescheduling] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCampaigns();

      const channel = supabase
        .channel('campaigns-realtime')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'message_campaigns',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setCampaigns(prev => prev.map(c =>
              c.id === payload.new.id ? payload.new : c
            ));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from('message_campaigns')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setCampaigns(data);
    }
    setLoading(false);
  };

  const updateCampaignStatus = async (campaignId: string, newStatus: string) => {
    const { error } = await supabase
      .from('message_campaigns')
      .update({ status: newStatus })
      .eq('id', campaignId)
      .eq('user_id', user?.id);

    if (error) {
      toast.error('Erro ao atualizar campanha');
      console.error('Error updating campaign:', error);
      return;
    }

    setCampaigns(prev => prev.map(c => 
      c.id === campaignId ? { ...c, status: newStatus } : c
    ));

    const messages: Record<string, string> = {
      paused: 'Campanha pausada',
      cancelled: 'Campanha cancelada',
      in_progress: 'Campanha retomada'
    };

    toast.success(messages[newStatus] || 'Status atualizado');
  };

  const handleCancelClick = (campaignId: string) => {
    setCampaignToCancel(campaignId);
    setCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    if (campaignToCancel) {
      await updateCampaignStatus(campaignToCancel, 'cancelled');
    }
    setCancelDialogOpen(false);
    setCampaignToCancel(null);
  };

  const handleRescheduleClick = (campaign: any) => {
    setCampaignToReschedule(campaign);
    if (campaign.scheduled_at) {
      const scheduledDate = new Date(campaign.scheduled_at);
      setNewScheduledDate(scheduledDate);
      setNewScheduledTime(format(scheduledDate, 'HH:mm'));
    } else {
      setNewScheduledDate(new Date());
      setNewScheduledTime("12:00");
    }
    setRescheduleDialogOpen(true);
  };

  const handleReschedule = async () => {
    if (!campaignToReschedule || !newScheduledDate) return;
    
    setIsRescheduling(true);
    
    try {
      const [hours, minutes] = newScheduledTime.split(':').map(Number);
      const scheduledAt = new Date(newScheduledDate);
      scheduledAt.setHours(hours, minutes, 0, 0);
      
      if (scheduledAt <= new Date()) {
        toast.error('A data/hora deve ser no futuro');
        return;
      }
      
      const { error } = await supabase
        .from('message_campaigns')
        .update({ scheduled_at: scheduledAt.toISOString(), status: 'scheduled' })
        .eq('id', campaignToReschedule.id)
        .eq('user_id', user?.id);

      if (error) {
        toast.error('Erro ao reagendar campanha');
        console.error('Error rescheduling campaign:', error);
        return;
      }

      setCampaigns(prev => prev.map(c => 
        c.id === campaignToReschedule.id 
          ? { ...c, scheduled_at: scheduledAt.toISOString(), status: 'scheduled' } 
          : c
      ));

      toast.success('Campanha reagendada com sucesso!');
      setRescheduleDialogOpen(false);
      setCampaignToReschedule(null);
    } finally {
      setIsRescheduling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string; className?: string }> = {
      pending: { variant: 'secondary', label: 'Pendente' },
      in_progress: { variant: 'outline', label: 'Em Andamento', className: 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
      paused: { variant: 'outline', label: 'Pausada', className: 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
      cancelled: { variant: 'outline', label: 'Cancelada', className: 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
      completed: { variant: 'default', label: 'Concluída', className: 'bg-green-600 hover:bg-green-700' },
      failed: { variant: 'destructive', label: 'Falhou' },
      scheduled: { variant: 'outline', label: 'Agendada', className: 'border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
      blocked: { variant: 'outline', label: 'Bloqueada', className: 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/30' },
    };

    const config = statusMap[status] || statusMap.pending;
    
    if (status === 'in_progress') {
      return (
        <Badge variant={config.variant} className={config.className}>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {config.label}
        </Badge>
      );
    }

    if (status === 'paused') {
      return (
        <Badge variant={config.variant} className={config.className}>
          <Pause className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      );
    }

    if (status === 'scheduled') {
      return (
        <Badge variant={config.variant} className={config.className}>
          <Clock className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
      );
    }

    if (status === 'blocked') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant={config.variant} className={config.className}>
                <Lock className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Campanha pausada por falta de assinatura ativa</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const getProgress = (campaign: any) => {
    const total = campaign.total_contacts || 0;
    const processed = (campaign.sent_count || 0) + (campaign.failed_count || 0);
    return total > 0 ? Math.round((processed / total) * 100) : 0;
  };

  const handleRowClick = (campaign: any, e: React.MouseEvent) => {
    // Don't open details if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) return;
    setSelectedCampaign(campaign);
    setDetailsOpen(true);
  };

const sendScheduledNow = async (campaignId: string) => {
    const { error } = await supabase
      .from('message_campaigns')
      .update({ status: 'in_progress', scheduled_at: null })
      .eq('id', campaignId)
      .eq('user_id', user?.id);

    if (error) {
      toast.error('Erro ao enviar campanha');
      console.error('Error sending scheduled campaign:', error);
      return;
    }

    setCampaigns(prev => prev.map(c => 
      c.id === campaignId ? { ...c, status: 'in_progress', scheduled_at: null } : c
    ));

    toast.success('Campanha enviada para processamento!');
  };

  const renderActions = (campaign: any) => {
    if (campaign.status === 'blocked') {
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/subscription');
            }}
            title="Assinar para desbloquear"
          >
            <CreditCard className="h-3 w-3" />
            <span className="hidden sm:inline">Assinar</span>
          </Button>
        </div>
      );
    }

    if (campaign.status === 'scheduled') {
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              sendScheduledNow(campaign.id);
            }}
            title="Enviar Agora"
          >
            <Send className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              handleRescheduleClick(campaign);
            }}
            title="Reagendar"
          >
            <CalendarClock className="h-4 w-4 text-purple-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              handleCancelClick(campaign.id);
            }}
            title="Cancelar"
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      );
    }

    if (campaign.status === 'in_progress') {
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              updateCampaignStatus(campaign.id, 'paused');
            }}
            title="Pausar"
          >
            <Pause className="h-4 w-4 text-blue-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              handleCancelClick(campaign.id);
            }}
            title="Cancelar"
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      );
    }

    if (campaign.status === 'paused') {
      return (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              updateCampaignStatus(campaign.id, 'in_progress');
            }}
            title="Retomar"
          >
            <Play className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              handleCancelClick(campaign.id);
            }}
            title="Cancelar"
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      );
    }

    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedCampaign(campaign);
          setDetailsOpen(true);
        }}
        title="Ver detalhes"
      >
        <Eye className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  };

  return (
    <>
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta campanha? Esta ação não pode ser desfeita e as mensagens pendentes não serão enviadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCancel} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar Campanha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-purple-600" />
              Reagendar Campanha
            </DialogTitle>
            <DialogDescription>
              Escolha uma nova data e hora para o envio da campanha "{campaignToReschedule?.campaign_name}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nova Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newScheduledDate && "text-muted-foreground"
                    )}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {newScheduledDate ? format(newScheduledDate, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newScheduledDate}
                    onSelect={setNewScheduledDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={newScheduledTime}
                onChange={(e) => setNewScheduledTime(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReschedule} disabled={isRescheduling || !newScheduledDate}>
              {isRescheduling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Reagendar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-secondary/10 p-3 sm:p-4">
        <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Voltar ao Dashboard</span>
            <span className="sm:hidden">Voltar</span>
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Campanhas</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma campanha encontrada
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 sm:mx-0">
                  <div className="inline-block min-w-full align-middle px-6 sm:px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">Campanha</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Data</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Agendado</TableHead>
                          <TableHead className="text-xs sm:text-sm">Total</TableHead>
                          <TableHead className="text-xs sm:text-sm">Enviados</TableHead>
                          <TableHead className="text-xs sm:text-sm hidden md:table-cell">Falhas</TableHead>
                          <TableHead className="text-xs sm:text-sm">Status</TableHead>
                          <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map((campaign) => (
                          <TableRow 
                            key={campaign.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={(e) => handleRowClick(campaign, e)}
                          >
                            <TableCell className="font-medium text-xs sm:text-sm max-w-[150px] truncate">
                              {campaign.campaign_name}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell whitespace-nowrap">
                              {format(new Date(campaign.created_at), 'dd/MM/yy HH:mm', {
                                locale: ptBR,
                              })}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden lg:table-cell whitespace-nowrap">
                              {campaign.scheduled_at ? (
                                <span className="flex items-center gap-1 text-purple-600">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(campaign.scheduled_at), 'dd/MM/yy HH:mm', {
                                    locale: ptBR,
                                  })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{campaign.total_contacts}</TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              <span className="text-green-600 font-medium">{campaign.sent_count}</span>
                              {campaign.status === 'in_progress' && (
                                <div className="mt-1">
                                  <Progress value={getProgress(campaign)} className="h-1.5 w-16" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-red-600 text-xs sm:text-sm hidden md:table-cell">
                              {campaign.failed_count}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{getStatusBadge(campaign.status)}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{renderActions(campaign)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CampaignDetailsDialog
        campaign={selectedCampaign}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </>
  );
};

export default History;
