import * as Icons from 'lucide-react';

export const getIcon = (iconName: string | null | undefined) => {
  if (!iconName) return Icons.FileText;
  
  const iconMap: { [key: string]: any } = {
    FileText: Icons.FileText,
    List: Icons.List,
    Database: Icons.Database,
    GitBranch: Icons.GitBranch,
    MessageSquare: Icons.MessageSquare,
    Settings: Icons.Settings,
    Users: Icons.Users,
    History: Icons.History,
    Zap: Icons.Zap,
    AlertTriangle: Icons.AlertTriangle,
    ClipboardList: Icons.ClipboardList,
    Menu: Icons.Menu,
  };
  
  return iconMap[iconName] || Icons.FileText;
};

