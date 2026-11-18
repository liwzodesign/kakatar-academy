import React from 'react';

interface LogoProps {
  /** « full » : blason + « Kakatar Academy » ; « mark » : blason seul */
  variant?: 'full' | 'mark';
  className?: string;
  /** Sur fond sombre, le logotype bleu marine est posé sur une pastille blanche pour rester lisible. */
  onDark?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ variant = 'full', className = 'h-10', onDark = false }) => {
  const img = (
    <img
      src={variant === 'full' ? '/logo.svg' : '/logo-mark.svg'}
      alt="Kakatar Academy"
      className={`${className} w-auto select-none`}
      draggable={false}
    />
  );
  return onDark ? <span className="inline-flex bg-white rounded-xl px-3 py-1.5 shadow-sm">{img}</span> : img;
};
