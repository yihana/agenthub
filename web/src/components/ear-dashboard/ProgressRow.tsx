import React from 'react';

interface ProgressRowProps {
  label: string;
  value: string;
  percent: number;
}

const ProgressRow: React.FC<ProgressRowProps> = ({ label, value, percent }) => {
  return (
    <div className="ear-progress">
      <div className="ear-progress__header">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="ear-progress__track">
        <div className="ear-progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export default ProgressRow;
