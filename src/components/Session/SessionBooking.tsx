import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  User, 
  CreditCard, 
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Session {
  id: string;
  title: string;
  description: string;
  date: Date;
  duration: number;
  location: string;
  capacity: number;
  registrations: number;
  price: number;
  instructor: {
    name: string;
    avatar?: string;
    bio: string;
  };
  type: 'ONLINE' | 'PRESENTIAL';
}

interface SessionBookingProps {
  session: Session;
  onBook: (sessionId: string, participantInfo: any) => void;
  onBack: () => void;
}

export const SessionBooking: React.FC<SessionBookingProps> = ({ session, onBook, onBack }) => {
  const [step, setStep] = useState(1);
  const [participantInfo, setParticipantInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    experience: '',
    expectations: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isLoading, setIsLoading] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const availableSpots = session.capacity - session.registrations;
  const isFullyBooked = availableSpots <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate booking process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    onBook(session.id, participantInfo);
    setIsLoading(false);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informations personnelles
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    value={participantInfo.firstName}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={participantInfo.lastName}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={participantInfo.email}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={participantInfo.phone}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entreprise/Organisation
                </label>
                <input
                  type="text"
                  value={participantInfo.company}
                  onChange={(e) => setParticipantInfo(prev => ({ ...prev, company: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informations complémentaires
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Niveau d'expérience
                  </label>
                  <select
                    value={participantInfo.experience}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, experience: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner votre niveau</option>
                    <option value="beginner">Débutant</option>
                    <option value="intermediate">Intermédiaire</option>
                    <option value="advanced">Avancé</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vos attentes pour cette session
                  </label>
                  <textarea
                    value={participantInfo.expectations}
                    onChange={(e) => setParticipantInfo(prev => ({ ...prev, expectations: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Décrivez ce que vous espérez apprendre ou accomplir..."
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Méthode de paiement
              </h3>
              
              <div className="space-y-4">
                <label className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="text-blue-600"
                  />
                  <CreditCard className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Carte bancaire</p>
                    <p className="text-sm text-gray-600">Visa, Mastercard, American Express</p>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value="mobile"
                    checked={paymentMethod === 'mobile'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="text-blue-600"
                  />
                  <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs">M</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Mobile Money</p>
                    <p className="text-sm text-gray-600">Orange Money, MTN Mobile Money, Moov Money</p>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3 p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="payment"
                    value="wave"
                    checked={paymentMethod === 'wave'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="text-blue-600"
                  />
                  <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs">W</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Wave</p>
                    <p className="text-sm text-gray-600">Paiement via Wave</p>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Politique d'annulation</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Vous pouvez annuler votre réservation jusqu'à 24h avant le début de la session 
                    pour un remboursement complet. Les annulations tardives ne sont pas remboursables.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900">
                    Réservation confirmée !
                  </h3>
                  <p className="text-green-800">
                    Votre place a été réservée avec succès.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Détails de votre réservation</h4>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Participant :</span>
                  <span className="font-medium">{participantInfo.firstName} {participantInfo.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email :</span>
                  <span className="font-medium">{participantInfo.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Session :</span>
                  <span className="font-medium">{session.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date :</span>
                  <span className="font-medium">{formatDate(session.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lieu :</span>
                  <span className="font-medium">{session.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Prix :</span>
                  <span className="font-medium">{formatPrice(session.price)} FCFA</span>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900">Prochaines étapes</h4>
                  <ul className="text-sm text-yellow-800 mt-1 space-y-1">
                    <li>• Un email de confirmation vous a été envoyé</li>
                    <li>• Vous recevrez un rappel 24h avant la session</li>
                    <li>• Préparez vos questions et matériel nécessaire</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={onBack}
          className="mb-6 text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Retour aux sessions
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Session Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{session.title}</h2>
              
              <div className="space-y-4 text-sm">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span>{formatDate(session.date)}</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span>{session.duration} minutes</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span>{session.location}</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span>{availableSpots} places restantes sur {session.capacity}</span>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{session.instructor.name}</p>
                    <p className="text-sm text-gray-600">Formateur</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{session.instructor.bio}</p>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {formatPrice(session.price)} FCFA
                  </div>
                  <p className="text-sm text-gray-600">Par participant</p>
                </div>
              </div>
              
              {isFullyBooked && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 text-center font-medium">
                    Session complète
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
              {/* Progress Steps */}
              {step < 3 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between">
                    {[
                      { id: 1, title: 'Informations' },
                      { id: 2, title: 'Paiement' }
                    ].map((stepItem, index) => (
                      <div key={stepItem.id} className="flex items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                            step >= stepItem.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {stepItem.id}
                        </div>
                        <span className={`ml-2 font-medium ${
                          step >= stepItem.id ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {stepItem.title}
                        </span>
                        {index < 1 && (
                          <div className={`flex-1 h-0.5 mx-8 ${
                            step > stepItem.id ? 'bg-blue-600' : 'bg-gray-200'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {renderStep()}
                
                {step < 3 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                    {step > 1 && (
                      <button
                        type="button"
                        onClick={() => setStep(step - 1)}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Précédent
                      </button>
                    )}
                    
                    <div className="ml-auto">
                      {step === 1 ? (
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          disabled={!participantInfo.firstName || !participantInfo.lastName || !participantInfo.email}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Continuer
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={isLoading || isFullyBooked}
                          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                          {isLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Traitement...</span>
                            </>
                          ) : (
                            <span>Confirmer la réservation</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};