import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Shield, FileText, Calendar, User, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AuditLog {
  id: string;
  admin_user_id: string;
  action_type: string;
  target_user_id: string | null;
  details: any;
  created_at: string;
  admin_profile?: {
    email: string;
    full_name: string;
  };
  target_profile?: {
    email: string;
    full_name: string;
  };
}

const actionTypeLabels: Record<string, string> = {
  view_support_chat: 'Visualizou Chat de Suporte',
  manage_role: 'Gerenciou Permissão',
  view_audit_log: 'Acessou Log de Auditoria',
  export_data: 'Exportou Dados',
  system_config: 'Alterou Configuração',
};

const actionTypeColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  view_support_chat: 'default',
  manage_role: 'secondary',
  view_audit_log: 'outline',
  export_data: 'secondary',
  system_config: 'destructive',
};

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
    loadAuditLogs();
    logAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      navigate('/dashboard');
    }
  };

  const logAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('admin_action_logs').insert({
      admin_user_id: user.id,
      action_type: 'view_audit_log',
      details: { timestamp: new Date().toISOString() }
    });
  };

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);

      const { data: logsData, error } = await supabase
        .from('admin_action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!logsData) return;

      // Buscar perfis dos admins e usuários alvo
      const adminIds = [...new Set(logsData.map(l => l.admin_user_id))];
      const targetIds = [...new Set(logsData.map(l => l.target_user_id).filter(Boolean))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', [...adminIds, ...targetIds]);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedLogs = logsData.map(log => ({
        ...log,
        admin_profile: profileMap.get(log.admin_user_id),
        target_profile: log.target_user_id ? profileMap.get(log.target_user_id) : undefined
      }));

      setLogs(enrichedLogs);
    } catch (error) {
      console.error('Erro ao carregar logs de auditoria:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = filterType === 'all' 
    ? logs 
    : logs.filter(log => log.action_type === filterType);

  const uniqueActionTypes = [...new Set(logs.map(l => l.action_type))];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Log de Auditoria</h1>
              <p className="text-muted-foreground">Registro de ações administrativas</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {uniqueActionTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {actionTypeLabels[type] || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum log encontrado</h3>
            <p className="text-muted-foreground">
              {filterType === 'all' 
                ? 'Nenhuma ação administrativa foi registrada ainda.'
                : 'Nenhuma ação deste tipo foi encontrada.'}
            </p>
          </Card>
        ) : (
          <Card>
            <ScrollArea className="h-[700px]">
              <div className="divide-y">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={actionTypeColors[log.action_type] || 'default'}>
                            {actionTypeLabels[log.action_type] || log.action_type}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Admin:</span>
                            <span className="text-muted-foreground">
                              {log.admin_profile?.full_name || 'Desconhecido'} ({log.admin_profile?.email})
                            </span>
                          </div>

                          {log.target_profile && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Alvo:</span>
                              <span className="text-muted-foreground">
                                {log.target_profile.full_name || 'Desconhecido'} ({log.target_profile.email})
                              </span>
                            </div>
                          )}

                          {Object.keys(log.details).length > 0 && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  );
}
