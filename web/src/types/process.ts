export interface ProcessStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'error';
  kpi: {
    count: number;
    avgTime: string;
    successRate: string;
  };
  backlog: number;
  recentItems: string[];
  errors: string[];
  permissions: string[];
}

export interface ProcessData {
  label: string;
  step: string;
  status: string;
  kpi: {
    count: number;
    avgTime: string;
    successRate: string;
  };
  backlog: number;
  recentItems: string[];
  errors: string[];
  permissions: string[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: 'received' | 'validated' | 'approved' | 'paid' | 'completed';
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ProcessAction {
  type: 'approve' | 'reject' | 'reset' | 'escalate';
  targetNodeId: string;
  reason?: string;
  userId?: string;
  timestamp?: string;
}

export interface AIQuery {
  query: string;
  selectedNode?: ProcessData;
  processData: ProcessData[];
}

export interface AIResponse {
  response: string;
  action?: ProcessAction;
  suggestions?: string[];
}
