/**
 * Utilitários para validação e formatação de CPF/CNPJ
 */

/**
 * Remove todos os caracteres não numéricos
 */
export const cleanDocument = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Detecta o tipo de documento baseado no número de dígitos
 */
export const detectDocumentType = (value: string): 'cpf' | 'cnpj' | null => {
  const clean = cleanDocument(value);
  if (clean.length <= 11) return 'cpf';
  if (clean.length <= 14) return 'cnpj';
  return null;
};

/**
 * Valida CPF usando dígitos verificadores
 */
export const validateCPF = (cpf: string): boolean => {
  const clean = cleanDocument(cpf);
  
  // Deve ter 11 dígitos
  if (clean.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais (inválido)
  if (/^(\d)\1+$/.test(clean)) return false;
  
  // Calcula primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.charAt(9))) return false;
  
  // Calcula segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.charAt(10))) return false;
  
  return true;
};

/**
 * Valida CNPJ usando dígitos verificadores
 */
export const validateCNPJ = (cnpj: string): boolean => {
  const clean = cleanDocument(cnpj);
  
  // Deve ter 14 dígitos
  if (clean.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais (inválido)
  if (/^(\d)\1+$/.test(clean)) return false;
  
  // Calcula primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(clean.charAt(i)) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(clean.charAt(12))) return false;
  
  // Calcula segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(clean.charAt(i)) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(clean.charAt(13))) return false;
  
  return true;
};

/**
 * Valida documento (CPF ou CNPJ)
 */
export const validateDocument = (value: string): boolean => {
  const clean = cleanDocument(value);
  
  if (clean.length === 11) {
    return validateCPF(clean);
  }
  
  if (clean.length === 14) {
    return validateCNPJ(clean);
  }
  
  return false;
};

/**
 * Aplica máscara de formatação ao documento
 */
export const formatDocument = (value: string): string => {
  const clean = cleanDocument(value);
  
  // CPF: 000.000.000-00
  if (clean.length <= 11) {
    return clean
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  
  // CNPJ: 00.000.000/0000-00
  return clean
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

/**
 * Retorna o nome do tipo de documento
 */
export const getDocumentTypeName = (value: string): string => {
  const clean = cleanDocument(value);
  if (clean.length === 11) return 'CPF';
  if (clean.length === 14) return 'CNPJ';
  return 'Documento';
};
