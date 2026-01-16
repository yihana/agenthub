import React from 'react';

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  highlight?: boolean;
}

const StatTile: React.FC<StatTileProps> = ({ label, value, delta, highlight }) => {
  return (
    <div className={`ear-stat ${highlight ? 'ear-stat--highlight' : ''}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {delta && <em>{delta}</em>}
    </div>
  );
};

export default StatTile;
