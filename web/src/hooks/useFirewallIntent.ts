import { useState } from 'react';

interface FirewallTemplate {
  id: string;
  title: string;
  description: string;
  fields: Array<{
    name: string;
    required: boolean;
    type: string;
    options?: string[];
  }>;
}

export const useFirewallIntent = () => {
  const [showFirewallModal, setShowFirewallModal] = useState(false);
  const [firewallTemplates, setFirewallTemplates] = useState<FirewallTemplate[]>([]);

  const handleFirewallIntent = (templates: FirewallTemplate[]) => {
    setFirewallTemplates(templates);
    setShowFirewallModal(true);
  };

  const closeFirewallModal = () => {
    setShowFirewallModal(false);
    setFirewallTemplates([]);
  };

  return {
    showFirewallModal,
    firewallTemplates,
    handleFirewallIntent,
    closeFirewallModal
  };
};
















