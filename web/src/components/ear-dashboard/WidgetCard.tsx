import React from 'react';

interface WidgetCardProps {
  title: string;
  description?: string;
  size?: 'small' | 'medium' | 'large';
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const WidgetCard: React.FC<WidgetCardProps> = ({
  title,
  description,
  size = 'medium',
  actions,
  children
}) => {
  return (
    <section className={`ear-card ear-card--${size}`}>
      <header className="ear-card__header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="ear-card__actions">{actions}</div>}
      </header>
      <div className="ear-card__body">{children}</div>
    </section>
  );
};

export default WidgetCard;
