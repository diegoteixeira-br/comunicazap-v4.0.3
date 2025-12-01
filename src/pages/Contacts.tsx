import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Tag as TagIcon, 
  Trash2, 
  Edit, 
  UserX,
  UserCheck,
  X,
  Download,
  Cake,
  Upload as UploadIcon,
  FileSpreadsheet,
  Send
} from "lucide-react";
import { ImportContactsModal } from "@/components/ImportContactsModal";
import { format, isSameDay } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  tags: string[];
  status: string;
  created_at: string;
  birthday: string | null;
}

const Contacts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  const [newContact, setNewContact] = useState({ phone: "", name: "", tags: "", birthday: "" });
  const [editTags, setEditTags] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  useEffect(() => {
    filterContacts();
    setCurrentPage(1); // Reset to first page when filters change
  }, [contacts, searchTerm, statusFilter, tagFilter]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContacts(data || []);
      
      // Extract all unique tags
      const tagsSet = new Set<string>();
      data?.forEach(contact => {
        contact.tags?.forEach((tag: string) => tagsSet.add(tag));
      });
      setAllTags(Array.from(tagsSet).sort());
      
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os contatos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = contacts;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(search) || 
        c.phone_number.includes(search)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    if (tagFilter === "birthday_today") {
      const today = new Date();
      const todayMonth = today.getMonth() + 1; // 1-12
      const todayDay = today.getDate();
      
      filtered = filtered.filter(c => {
        if (!c.birthday) return false;
        const [, month, day] = c.birthday.split('-');
        return parseInt(month) === todayMonth && parseInt(day) === todayDay;
      });
    } else if (tagFilter && tagFilter !== "all") {
      filtered = filtered.filter(c => c.tags?.includes(tagFilter));
    }

    setFilteredContacts(filtered);
  };

  const handleAddContact = async () => {
    if (!newContact.phone) {
      toast({
        title: "Erro",
        description: "O número de telefone é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      const tags = newContact.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const { error } = await supabase
        .from('contacts')
        .insert({
          user_id: user?.id,
          phone_number: newContact.phone,
          name: newContact.name || null,
          tags: tags,
          birthday: newContact.birthday || null,
          status: 'active'
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato adicionado com sucesso"
      });

      setShowAddDialog(false);
      setNewContact({ phone: "", name: "", tags: "", birthday: "" });
      fetchContacts();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message.includes('duplicate') 
          ? "Este contato já existe" 
          : "Não foi possível adicionar o contato",
        variant: "destructive"
      });
    }
  };

  const handleImportContacts = async (importedContacts: { name: string; phone: string }[]) => {
    try {
      // Buscar contatos existentes para comparar
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('phone_number')
        .eq('user_id', user?.id);
      
      const existingPhones = new Set(existingContacts?.map(c => c.phone_number) || []);
      
      // Separar novos e duplicados
      const newContacts = importedContacts.filter(c => !existingPhones.has(c.phone));
      const duplicates = importedContacts.length - newContacts.length;

      if (newContacts.length === 0) {
        toast({
          title: "Nenhum contato novo",
          description: `Todos os ${duplicates} contatos selecionados já existem na sua lista`,
        });
        return;
      }

      const contactsToInsert = newContacts.map(c => ({
        user_id: user?.id,
        phone_number: c.phone,
        name: c.name || null,
        tags: [],
        status: 'active'
      }));

      const { error } = await supabase
        .from('contacts')
        .insert(contactsToInsert);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `${newContacts.length} novo(s) contato(s) importado(s)${duplicates > 0 ? `, ${duplicates} já existiam` : ''}`
      });

      fetchContacts();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível importar os contatos",
        variant: "destructive"
      });
    }
  };

  const handleEditContact = async () => {
    if (!editingContact) return;

    try {
      const tags = editTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const { error } = await supabase
        .from('contacts')
        .update({
          name: editingContact.name,
          tags: tags,
          birthday: editingContact.birthday || null
        })
        .eq('id', editingContact.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato atualizado com sucesso"
      });

      setShowEditDialog(false);
      setEditingContact(null);
      fetchContacts();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o contato",
        variant: "destructive"
      });
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Tem certeza que deseja excluir este contato?")) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato excluído com sucesso"
      });

      fetchContacts();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o contato",
        variant: "destructive"
      });
    }
  };

  const handleBulkAddTags = async () => {
    if (selectedContacts.size === 0 || !bulkTags.trim()) return;

    try {
      const newTags = bulkTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const selectedContactsList = contacts.filter(c => selectedContacts.has(c.id));

      for (const contact of selectedContactsList) {
        const updatedTags = [...new Set([...contact.tags, ...newTags])];
        
        await supabase
          .from('contacts')
          .update({ tags: updatedTags })
          .eq('id', contact.id);
      }

      toast({
        title: "Sucesso",
        description: `Tags adicionadas a ${selectedContacts.size} contato(s)`
      });

      setShowBulkTagDialog(false);
      setBulkTags("");
      setSelectedContacts(new Set());
      fetchContacts();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar as tags",
        variant: "destructive"
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.size === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${selectedContacts.size} contato(s)?`)) return;

    try {
      for (const contactId of Array.from(selectedContacts)) {
        await supabase
          .from('contacts')
          .delete()
          .eq('id', contactId);
      }

      toast({
        title: "Sucesso",
        description: `${selectedContacts.size} contato(s) excluído(s)`
      });

      setSelectedContacts(new Set());
      fetchContacts();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir os contatos",
        variant: "destructive"
      });
    }
  };

  const toggleContactSelection = (contactId: string) => {
    const newSelection = new Set(selectedContacts);
    if (newSelection.has(contactId)) {
      newSelection.delete(contactId);
    } else {
      newSelection.add(contactId);
    }
    setSelectedContacts(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const processSpreadsheetFile = async (file: File) => {
    setIsProcessingFile(true);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (!fileExtension || !['xlsx', 'xls', 'csv'].includes(fileExtension)) {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie apenas arquivos .xlsx, .xls ou .csv",
          variant: "destructive"
        });
        setIsProcessingFile(false);
        return;
      }

      let rows: any[] = [];

      if (fileExtension === 'csv') {
        const text = await file.text();
        Papa.parse(text, {
          header: true,
          complete: (results) => {
            rows = results.data;
            importContactsFromSpreadsheet(rows);
          },
          error: () => {
            toast({
              title: "Erro",
              description: "Erro ao processar CSV",
              variant: "destructive"
            });
            setIsProcessingFile(false);
          }
        });
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet);
        importContactsFromSpreadsheet(rows);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Verifique se o arquivo está no formato correto",
        variant: "destructive"
      });
      setIsProcessingFile(false);
    }
  };

  const importContactsFromSpreadsheet = async (rows: any[]) => {
    if (!rows || rows.length === 0) {
      toast({
        title: "Planilha vazia",
        description: "A planilha não contém dados válidos",
        variant: "destructive"
      });
      setIsProcessingFile(false);
      return;
    }

    try {
      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        // Aceitar diferentes formatos de coluna
        const name = row["Nome do Cliente"] || row["Nome"] || row["name"] || "";
        const phone = row["Telefone do Cliente"] || row["Telefone"] || row["phone"] || "";
        const birthday = row["Aniversário"] || row["Data de Nascimento"] || row["birthday"] || null;
        const tagsStr = row["Tags"] || row["tags"] || "";

        if (!name || !phone) {
          skipped++;
          continue;
        }

        const tags = tagsStr ? tagsStr.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [];

        const { error } = await supabase
          .from('contacts')
          .insert({
            user_id: user?.id,
            phone_number: phone.toString().trim(),
            name: name.toString().trim(),
            tags,
            birthday: birthday || null,
            status: 'active'
          });

        if (error) {
          skipped++;
        } else {
          imported++;
        }
      }

      toast({
        title: "Importação concluída!",
        description: `${imported} contato(s) importado(s)${skipped > 0 ? `, ${skipped} ignorado(s)` : ''}`,
      });

      setShowUploadDialog(false);
      fetchContacts();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível importar os contatos",
        variant: "destructive"
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSpreadsheetFile(file);
    }
  };

  const handleCreateCampaign = () => {
    // Filtrar apenas contatos ativos selecionados
    const selectedContactsList = contacts
      .filter(c => selectedContacts.has(c.id) && c.status === 'active')
      .map(c => ({
        "Nome do Cliente": c.name || c.phone_number,
        "Telefone do Cliente": c.phone_number
      }));

    if (selectedContactsList.length === 0) {
      toast({
        title: "Nenhum contato válido",
        description: "Selecione contatos ativos para criar uma campanha",
        variant: "destructive"
      });
      return;
    }

    // Salvar no sessionStorage e navegar para /results
    sessionStorage.setItem("clientData", JSON.stringify(selectedContactsList));
    sessionStorage.removeItem("selectedTags");
    sessionStorage.removeItem("selectedGroups");
    navigate("/results");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Gestão de Contatos</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie seus contatos e organize por tags
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/birthday-calendar")}>
                <Cake className="mr-2 h-4 w-4" />
                Calendário
              </Button>
              <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Planilha
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Download className="mr-2 h-4 w-4" />
                Importar do WhatsApp
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Contato
              </Button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Filtros e Busca */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="unsubscribed">Descadastrados</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as tags</SelectItem>
                    <SelectItem value="birthday_today">
                      <div className="flex items-center gap-2">
                        <Cake className="h-4 w-4" />
                        Aniversariantes do Dia
                      </div>
                    </SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Botões de Ação (quando há seleção) */}
              {selectedContacts.size > 0 && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={handleCreateCampaign}
                    className="w-full sm:w-auto"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Criar Campanha ({selectedContacts.size})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowBulkTagDialog(true)}
                    className="w-full sm:w-auto"
                  >
                    <TagIcon className="mr-2 h-4 w-4" />
                    Adicionar Tags
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleBulkDelete}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contacts List */}
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </CardContent>
          </Card>
        ) : filteredContacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">Nenhum contato encontrado</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Primeiro Contato
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>
                  {filteredContacts.length} Contatos
                  {filteredContacts.length > itemsPerPage && (
                    <span className="text-sm text-muted-foreground ml-2">
                      (Página {currentPage} de {Math.ceil(filteredContacts.length / itemsPerPage)})
                    </span>
                  )}
                </CardTitle>
                <Checkbox
                  checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                  onCheckedChange={toggleAllSelection}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredContacts
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Checkbox
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={() => toggleContactSelection(contact.id)}
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {contact.name || contact.phone_number}
                          </span>
                          {contact.status === 'active' ? (
                            <Badge variant="default" className="gap-1">
                              <UserCheck className="h-3 w-3" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <UserX className="h-3 w-3" />
                              Descadastrado
                            </Badge>
                          )}
                        </div>
                        {contact.name && (
                          <p className="text-sm text-muted-foreground">
                            {contact.phone_number}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {contact.birthday && (
                            <Badge variant="secondary" className="gap-1">
                              <Cake className="h-3 w-3" />
                              {contact.birthday.split('-').slice(1).reverse().join('/')}
                            </Badge>
                          )}
                          {contact.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline">
                              <TagIcon className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingContact(contact);
                          setEditTags(contact.tags.join(', '));
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination Controls */}
              {filteredContacts.length > itemsPerPage && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredContacts.length)} de {filteredContacts.length} contatos
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredContacts.length / itemsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(filteredContacts.length / itemsPerPage)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Contact Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Contato</DialogTitle>
              <DialogDescription>
                Adicione um novo contato à sua lista
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  placeholder="+5511999999999"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Nome do contato"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="birthday">Data de Aniversário</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={newContact.birthday}
                  onChange={(e) => setNewContact({ ...newContact, birthday: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                <Input
                  id="tags"
                  placeholder="cliente, vip, campanha2024"
                  value={newContact.tags}
                  onChange={(e) => setNewContact({ ...newContact, tags: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddContact}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Contact Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Contato</DialogTitle>
              <DialogDescription>
                Atualize as informações do contato
              </DialogDescription>
            </DialogHeader>
            {editingContact && (
              <div className="space-y-4">
                <div>
                  <Label>Telefone</Label>
                  <Input value={editingContact.phone_number} disabled />
                </div>
                <div>
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
                    value={editingContact.name || ""}
                    onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-birthday">Data de Aniversário</Label>
                  <Input
                    id="edit-birthday"
                    type="date"
                    value={editingContact.birthday || ""}
                    onChange={(e) => setEditingContact({ ...editingContact, birthday: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-tags">Tags (separadas por vírgula)</Label>
                  <Input
                    id="edit-tags"
                    placeholder="cliente, vip, campanha2024"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditContact}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Add Tags Dialog */}
        <Dialog open={showBulkTagDialog} onOpenChange={setShowBulkTagDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Tags em Massa</DialogTitle>
              <DialogDescription>
                Adicione tags a {selectedContacts.size} contato(s) selecionado(s)
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="bulk-tags">Tags (separadas por vírgula)</Label>
              <Input
                id="bulk-tags"
                placeholder="nova-tag, campanha2024"
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkTagDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleBulkAddTags}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Spreadsheet Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Upload de Planilha
              </DialogTitle>
              <DialogDescription>
                Importe contatos através de uma planilha Excel (.xlsx, .xls) ou CSV
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="spreadsheet-input"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInput}
                  disabled={isProcessingFile}
                />
                <UploadIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-base font-medium mb-2">
                  {isProcessingFile ? "Processando..." : "Selecione sua planilha"}
                </p>
                <Button
                  variant="outline"
                  disabled={isProcessingFile}
                  onClick={() => document.getElementById('spreadsheet-input')?.click()}
                  className="mt-2"
                >
                  Escolher Arquivo
                </Button>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-sm">Formato da planilha:</h4>
                <p className="text-sm text-muted-foreground">
                  Sua planilha deve conter as seguintes colunas:
                </p>
                <div className="bg-background p-3 rounded font-mono text-xs space-y-1">
                  <div>• <span className="text-primary">Nome do Cliente</span> ou <span className="text-primary">Nome</span> (obrigatório)</div>
                  <div>• <span className="text-primary">Telefone do Cliente</span> ou <span className="text-primary">Telefone</span> (obrigatório)</div>
                  <div>• <span className="text-muted-foreground">Aniversário</span> ou <span className="text-muted-foreground">Data de Nascimento</span> (opcional)</div>
                  <div>• <span className="text-muted-foreground">Tags</span> (opcional, separadas por vírgula)</div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowUploadDialog(false)}
                disabled={isProcessingFile}
              >
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Contacts Modal */}
        <ImportContactsModal
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImport={handleImportContacts}
        />
      </div>
    </div>
  );
};

export default Contacts;
