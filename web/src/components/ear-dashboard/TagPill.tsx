import React from 'react';

interface TagPillProps {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'info' | 'neutral';
}

const TagPill: React.FC<TagPillProps> = ({ label, tone = 'default' }) => {
  return <span className={`ear-pill ear-pill--${tone}`}>{label}</span>;
};

export default TagPill;
