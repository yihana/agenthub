import React from 'react';

interface ChartPlaceholderProps {
  label: string;
  summary?: string;
}

const ChartPlaceholder: React.FC<ChartPlaceholderProps> = ({ label, summary }) => {
  return (
    <div className="ear-chart">
      <div className="ear-chart__header">
        <strong>{label}</strong>
        {summary && <span>{summary}</span>}
      </div>
      <div className="ear-chart__visual">
        <div className="ear-chart__bar" />
        <div className="ear-chart__bar" />
        <div className="ear-chart__bar" />
        <div className="ear-chart__bar" />
        <div className="ear-chart__bar" />
      </div>
      <div className="ear-chart__axis">
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
      </div>
    </div>
  );
};

export default ChartPlaceholder;
