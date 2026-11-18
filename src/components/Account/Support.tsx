import React, { useState } from 'react';
import { ChevronDown, Mail } from 'lucide-react';
import { Card, PageHeader } from '../UI';

const FAQ = [
  ['Comment payer un cours ?', 'Cliquez sur « Acheter ce cours », choisissez Wave, Orange Money / Free Money (via PayDunya) ou carte bancaire, puis validez sur la page sécurisée de la passerelle. Votre accès est ouvert dès la confirmation du paiement.'],
  ['Puis-je être remboursé ?', 'Contactez le support en indiquant la référence de votre paiement (présente sur le reçu reçu par email). Chaque demande est étudiée par l\'équipe Kakatar Academy.'],
  ['Comment obtenir mon certificat ?', 'Terminez toutes les leçons du cours (et réussissez les quiz). Le certificat est délivré automatiquement et vérifiable publiquement grâce à son code.'],
  ['Comment devenir formateur ?', 'Créez un compte formateur, puis déposez votre pièce d\'identité et votre CV dans Paramètres → Vérification. Une fois vérifié, vous pourrez publier vos cours et recevoir vos revenus.'],
  ['Quand les formateurs sont-ils payés ?', 'Vos revenus (prix payé moins la commission plateforme) apparaissent dans « Revenus & stats ». Les versements sont effectués régulièrement par l\'équipe financière.'],
  ['Comment rejoindre une session en ligne ?', 'Depuis la page de la session, le bouton « Rejoindre la salle » est actif 15 minutes avant le début. Vous recevez aussi un rappel par email la veille et une heure avant.'],
  ['Comment sécuriser mon compte ?', 'Activez l\'authentification à deux facteurs dans Paramètres → Sécurité.'],
];

export const Support: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Support" subtitle="Questions fréquentes et contact" />
      <div className="space-y-3">
        {FAQ.map(([q, a], i) => (
          <div key={q} className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left font-medium text-gray-900">
              {q}
              <ChevronDown className={`w-5 h-5 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && <p className="px-4 pb-4 text-gray-600">{a}</p>}
          </div>
        ))}
      </div>
      <Card className="mt-6 flex items-center space-x-4">
        <Mail className="w-8 h-8 text-primary-600" />
        <div>
          <p className="font-medium text-gray-900">Besoin d'aide supplémentaire ?</p>
          <a href="mailto:support@kakataracademy.com" className="text-primary-700 font-semibold hover:underline">support@kakataracademy.com</a>
        </div>
      </Card>
    </div>
  );
};
