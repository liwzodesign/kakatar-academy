import React from 'react';
import { navigate } from '../../lib/router';
import { Logo } from '../UI/Logo';

const COLUMNS = [
  { title: 'Apprendre', links: [['Catalogue des cours', '/catalog'], ['Parcours', '/paths'], ['Sessions en direct', '/sessions'], ['Ressources', '/marketplace']] },
  { title: 'Aide', links: [['Questions fréquentes', '/support'], ['Vérifier un certificat', '/verify']] },
];

export const Footer: React.FC = () => (
  <footer className="bg-white border-t border-gray-100">
    <div className="container-page py-12 grid gap-10 md:grid-cols-4">
      <div className="md:col-span-2">
        <Logo className="h-10" />
        <p className="mt-4 text-sm text-gray-500 max-w-sm">
          La plateforme d'apprentissage hybride : cours en ligne, sessions en direct et certificats vérifiables.
        </p>
      </div>
      {COLUMNS.map((col) => (
        <div key={col.title}>
          <p className="text-sm font-bold text-gray-900">{col.title}</p>
          <ul className="mt-3 space-y-2">
            {col.links.map(([label, to]) => (
              <li key={label}>
                <button onClick={() => navigate(to)} className="text-sm text-gray-500 hover:text-primary-700">{label}</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-gray-100">
      <p className="container-page py-5 text-xs text-gray-400">© {new Date().getFullYear()} Kakatar Academy. Tous droits réservés.</p>
    </div>
  </footer>
);
