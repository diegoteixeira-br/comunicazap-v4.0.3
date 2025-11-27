import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Plus, Search, Eye, Copy, Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  MessageTemplate,
  getAllTemplates,
  saveCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  getCategoryIcon,
  getCategoryLabel,
} from "@/data/messageTemplates";

const Templates = () => {
  const navigate = useNavigate();
  
  // Templates
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<MessageTemplate[]>([]);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  // Modal de Criar/Editar
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  
  // Formulário
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formCategory, setFormCategory] = useState<MessageTemplate["category"]>("personalizado");
  
  // Pré-visualização
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  
  // Exclusão
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<MessageTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [templates, searchQuery, categoryFilter]);

  const loadTemplates = () => {
    const allTemplates = getAllTemplates();
    setTemplates(allTemplates);
  };

  const applyFilters = () => {
    let filtered = [...templates];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.message.toLowerCase().includes(query)
      );
    }
    
    if (categoryFilter !== "all") {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }
    
    setFilteredTemplates(filtered);
  };

  const resetForm = () => {
    setFormTitle("");
    setFormMessage("");
    setFormCategory("personalizado");
    setEditingTemplate(null);
    setShowCreateDialog(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const handleOpenEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormTitle(template.title);
    setFormMessage(template.message);
    setFormCategory(template.category);
    setShowCreateDialog(true);
  };

  const handleSaveTemplate = () => {
    if (!formTitle.trim() || !formMessage.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha título e mensagem.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const template: MessageTemplate = {
        id: editingTemplate?.id || `custom-${Date.now()}`,
        title: formTitle.trim(),
        message: formMessage.trim(),
        category: formCategory,
        isCustom: true,
        createdAt: editingTemplate?.createdAt || new Date().toISOString()
      };
      
      if (editingTemplate) {
        updateCustomTemplate(template);
        toast({
          title: "Template atualizado!",
          description: "Suas alterações foram salvas.",
        });
      } else {
        saveCustomTemplate(template);
        toast({
          title: "Template criado!",
          description: "Novo template adicionado com sucesso.",
        });
      }
      
      loadTemplates();
      resetForm();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o template.",
        variant: "destructive",
      });
    }
  };

  const handleOpenDelete = (template: MessageTemplate) => {
    setDeletingTemplate(template);
    setShowDeleteDialog(true);
  };

  const handleDeleteTemplate = () => {
    if (!deletingTemplate) return;
    
    try {
      deleteCustomTemplate(deletingTemplate.id);
      loadTemplates();
      toast({
        title: "Template excluído!",
        description: "O template foi removido com sucesso.",
      });
      setShowDeleteDialog(false);
      setDeletingTemplate(null);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir o template.",
        variant: "destructive",
      });
    }
  };

  const handleCopyTemplate = (message: string) => {
    navigator.clipboard.writeText(message);
    toast({
      title: "Copiado!",
      description: "Template copiado para área de transferência.",
    });
  };

  const handleOpenPreview = (template: MessageTemplate) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const getPreviewMessage = (message: string) => {
    return message.replace(/{nome}/g, "João");
  };

  const defaultTemplates = filteredTemplates.filter(t => !t.isCustom);
  const customTemplates = filteredTemplates.filter(t => t.isCustom);

  const categories: Array<{ value: string; label: string }> = [
    { value: "all", label: "Todas Categorias" },
    { value: "opt-in", label: "✅ Opt-in" },
    { value: "saudacao", label: "👋 Saudação" },
    { value: "lembrete", label: "📅 Lembrete" },
    { value: "promocao", label: "🎁 Promoção" },
    { value: "agradecimento", label: "💚 Agradecimento" },
    { value: "aniversario", label: "🎂 Aniversário" },
    { value: "personalizado", label: "✏️ Personalizado" },
  ];

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <Button
                variant="ghost"
                onClick={() => navigate("/dashboard")}
                className="mb-4 gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Dashboard
              </Button>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                📝 Templates de Mensagens
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerencie seus modelos de mensagens
              </p>
            </div>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Template
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Templates Padrão */}
          {defaultTemplates.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                📋 Templates Padrão
                <Badge variant="secondary">{defaultTemplates.length}</Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {defaultTemplates.map((template) => (
                  <Card key={template.id} className="hover:border-primary/40 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {getCategoryIcon(template.category)}
                            {template.title}
                          </CardTitle>
                          <Badge variant="outline" className="mt-2">
                            {getCategoryLabel(template.category)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {template.message.substring(0, 100)}...
                      </p>
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPreview(template)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Visualizar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyTemplate(template.message)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copiar</TooltipContent>
                        </Tooltip>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Templates Personalizados */}
          {customTemplates.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                ✏️ Meus Templates
                <Badge variant="secondary">{customTemplates.length}</Badge>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customTemplates.map((template) => (
                  <Card key={template.id} className="hover:border-primary/40 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {getCategoryIcon(template.category)}
                            {template.title}
                          </CardTitle>
                          <Badge variant="outline" className="mt-2">
                            {getCategoryLabel(template.category)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {template.message.substring(0, 100)}...
                      </p>
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPreview(template)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Visualizar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyTemplate(template.message)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copiar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEdit(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDelete(template)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir</TooltipContent>
                        </Tooltip>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Mensagem vazia */}
          {filteredTemplates.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground">
                  Nenhum template encontrado com os filtros aplicados.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Modal Criar/Editar */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "✏️ Editar Template" : "➕ Novo Template"}
                </DialogTitle>
                <DialogDescription>
                  {editingTemplate 
                    ? "Modifique seu template personalizado"
                    : "Crie um novo template de mensagem personalizado"
                  }
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Título do Template *
                  </label>
                  <Input
                    placeholder="Ex: Meu template de aniversário"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Categoria *
                  </label>
                  <Select value={formCategory} onValueChange={(value: any) => setFormCategory(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personalizado">✏️ Personalizado</SelectItem>
                      <SelectItem value="opt-in">✅ Opt-in</SelectItem>
                      <SelectItem value="saudacao">👋 Saudação</SelectItem>
                      <SelectItem value="lembrete">📅 Lembrete</SelectItem>
                      <SelectItem value="promocao">🎁 Promoção</SelectItem>
                      <SelectItem value="agradecimento">💚 Agradecimento</SelectItem>
                      <SelectItem value="aniversario">🎂 Aniversário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Mensagem *
                  </label>
                  <Textarea
                    placeholder="Olá {nome}! 🎉&#10;Feliz aniversário! Que seu dia seja repleto de alegrias..."
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 Use {"{nome}"} para inserir o nome do contato
                  </p>
                </div>

                {formMessage && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      👁️ Pré-visualização:
                    </label>
                    <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                      {getPreviewMessage(formMessage)}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveTemplate}>
                  💾 Salvar Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal Pré-visualização */}
          <Dialog open={showPreview} onOpenChange={setShowPreview}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {previewTemplate && getCategoryIcon(previewTemplate.category)}
                  {previewTemplate?.title}
                </DialogTitle>
                <DialogDescription>
                  Pré-visualização com nome de exemplo
                </DialogDescription>
              </DialogHeader>
              <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                {previewTemplate && getPreviewMessage(previewTemplate.message)}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Fechar
                </Button>
                <Button onClick={() => {
                  if (previewTemplate) {
                    handleCopyTemplate(previewTemplate.message);
                    setShowPreview(false);
                  }
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dialog Confirmar Exclusão */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o template "{deletingTemplate?.title}"? 
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingTemplate(null)}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTemplate}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Templates;
