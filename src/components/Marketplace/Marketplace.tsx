import React, { useState } from 'react';
import { Search, Plus, Star, Download, Package, Truck, CheckCircle } from 'lucide-react';
import { api, downloadFile, request, unwrap } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { mapOrder, mapProduct } from '../../lib/mappers';
import { navigate } from '../../lib/router';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import { Order, Product } from '../../types';
import { Avatar, Card, EmptyState, ErrorBox, Modal, PageHeader, Spinner, SuccessBox, buttonPrimary, buttonSecondary, inputClass } from '../UI';
import { CheckoutModal } from '../Payment/CheckoutModal';

export const PRODUCT_TYPES: Record<string, string> = {
  TEMPLATE: 'Template', SOURCE_CODE: 'Code source', EBOOK: 'E-book', RESOURCE: 'Ressource', COACHING: 'Coaching', SERVICE: 'Prestation',
};

const ProductForm: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ title: '', description: '', type: 'TEMPLATE', price: '0', delivery_days: '3', preview_url: '' });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const digital = ['TEMPLATE', 'SOURCE_CODE', 'EBOOK', 'RESOURCE'].includes(form.type);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    if (file) body.append(file.type.startsWith('image/') && !digital ? 'preview_image' : 'file', file);
    try {
      await request('/marketplace/products/create/', { method: 'POST', body });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title="Nouveau produit" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input className={inputClass} placeholder="Titre" value={form.title} onChange={set('title')} required />
        <textarea className={inputClass} placeholder="Description" rows={4} value={form.description} onChange={set('description')} required />
        <div className="grid grid-cols-2 gap-3">
          <select className={inputClass} value={form.type} onChange={set('type')}>
            {Object.entries(PRODUCT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" min={0} step={500} className={inputClass} placeholder="Prix (FCFA)" value={form.price} onChange={set('price')} />
        </div>
        {digital ? (
          <label className="block text-sm">Fichier livré après achat (zip, pdf…)<input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block mt-1" /></label>
        ) : (
          <label className="block text-sm">Délai de livraison (jours)<input type="number" min={1} className={inputClass} value={form.delivery_days} onChange={set('delivery_days')} /></label>
        )}
        <input className={inputClass} placeholder="URL d'une image d'aperçu (facultatif)" value={form.preview_url} onChange={set('preview_url')} />
        {error && <ErrorBox message={error} />}
        <button className={`${buttonPrimary} w-full`}>Mettre en vente</button>
      </form>
    </Modal>
  );
};

const DeliverModal: React.FC<{ order: Order; onClose: () => void; onDone: () => void }> = ({ order, onClose, onDone }) => {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = new FormData();
    body.append('delivery_message', message);
    if (file) body.append('delivery_file', file);
    try {
      await request(`/marketplace/orders/${order.id}/deliver/`, { method: 'POST', body });
      onDone();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <Modal title={`Livrer : ${order.product.title}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {order.requirements && <p className="text-sm bg-gray-50 p-3 rounded">Besoins de l'acheteur : {order.requirements}</p>}
        <textarea className={inputClass} rows={4} placeholder="Message de livraison (lien de visio, explications…)" value={message} onChange={(e) => setMessage(e.target.value)} required />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        {error && <ErrorBox message={error} />}
        <button className={`${buttonPrimary} w-full`}>Livrer la commande</button>
      </form>
    </Modal>
  );
};

const SellerSpace: React.FC = () => {
  const { data, loading, error, reload } = useApi(async () => {
    const [products, sales] = await Promise.all([api.get('/marketplace/products/mine/'), api.get('/marketplace/orders/sales/')]);
    return { products: (products as any[]).map(mapProduct), sales: (sales as any[]).map(mapOrder) };
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [delivering, setDelivering] = useState<Order | null>(null);

  if (loading) return <Spinner className="h-40" />;
  if (error || !data) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className={`${buttonPrimary} flex items-center space-x-2`}><Plus className="w-4 h-4" /><span>Vendre un produit</span></button>
      </div>
      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">Mes produits ({data.products.length})</h2>
        {data.products.length === 0 ? <p className="text-sm text-gray-500">Aucun produit en vente.</p> : (
          <div className="divide-y">
            {data.products.map((p) => (
              <div key={p.id} className="py-3 flex items-center justify-between text-sm">
                <div><p className="font-medium text-gray-900">{p.title}</p><p className="text-gray-500">{PRODUCT_TYPES[p.type]} · {formatPrice(p.price, p.currency)}</p></div>
                <span className="text-gray-600">{p.salesCount} vente(s)</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="font-semibold text-gray-900 mb-3">Mes ventes</h2>
        {data.sales.length === 0 ? <p className="text-sm text-gray-500">Aucune vente pour le moment.</p> : (
          <div className="divide-y">
            {data.sales.map((o) => (
              <div key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div><p className="font-medium text-gray-900">{o.product.title}</p><p className="text-gray-500">{o.buyer.name} · {o.createdAt.toLocaleDateString('fr-FR')} · {formatPrice(o.amount, o.currency)}</p></div>
                {o.status === 'PAID' && !o.product.isDigital ? (
                  <button onClick={() => setDelivering(o)} className={`${buttonPrimary} flex items-center space-x-1`}><Truck className="w-4 h-4" /><span>Livrer</span></button>
                ) : <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">{o.status === 'COMPLETED' ? 'Terminée' : o.status === 'DELIVERED' ? 'Livrée' : o.status}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>
      {showForm && <ProductForm onClose={() => setShowForm(false)} onSaved={reload} />}
      {delivering && <DeliverModal order={delivering} onClose={() => setDelivering(null)} onDone={reload} />}
    </div>
  );
};

export const ProductDetail: React.FC<{ slug: string; onRequireAuth: () => void }> = ({ slug, onRequireAuth }) => {
  const { authState } = useAuth();
  const { data: product, loading, error, reload } = useApi(async () => mapProduct(await api.get(`/marketplace/products/${slug}/`)), [slug, authState.isAuthenticated]);
  const [requirements, setRequirements] = useState('');
  const [checkout, setCheckout] = useState(false);
  const [notice, setNotice] = useState('');
  const [err, setErr] = useState('');

  if (loading) return <Spinner />;
  if (error || !product) return <ErrorBox message={error || 'Produit introuvable'} />;

  const buy = async () => {
    if (!authState.isAuthenticated) return onRequireAuth();
    setErr('');
    if (product.price > 0) return setCheckout(true);
    try {
      await api.post(`/marketplace/products/${slug}/purchase/`, { requirements });
      setNotice('Commande confirmée ! Retrouvez-la dans « Mes achats ».');
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/marketplace')} className="text-gray-600 hover:text-gray-900">← Retour à la marketplace</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <img src={product.preview} alt="" className="w-full h-72 object-cover rounded-xl" />
          <Card>
            <span className="text-xs font-semibold text-primary-600 uppercase">{PRODUCT_TYPES[product.type]}</span>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{product.title}</h1>
            <p className="text-gray-700 whitespace-pre-line mt-4">{product.description}</p>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="space-y-4">
            <p className="text-3xl font-bold text-gray-900">{formatPrice(product.price, product.currency)}</p>
            <p className="text-sm text-gray-500">{product.isDigital ? 'Téléchargement immédiat après paiement' : `Livraison sous ${product.deliveryDays} jour(s)`}</p>
            {!product.isDigital && !product.isOwner && (
              <textarea className={inputClass} rows={3} placeholder="Décrivez votre besoin au vendeur" value={requirements} onChange={(e) => setRequirements(e.target.value)} />
            )}
            {err && <ErrorBox message={err} />}
            {notice && <SuccessBox message={notice} />}
            {product.isOwner ? <p className="text-sm text-gray-500">Vous êtes le vendeur de ce produit.</p>
              : product.hasPurchased && product.isDigital ? <button onClick={() => navigate('/purchases')} className={`${buttonSecondary} w-full`}>Déjà acheté — voir mes achats</button>
              : <button onClick={buy} className={`${buttonPrimary} w-full py-3`}>{product.price > 0 ? 'Acheter' : 'Obtenir gratuitement'}</button>}
          </Card>
          <Card>
            <div className="flex items-center space-x-3">
              <Avatar name={product.seller.name} src={product.seller.avatar} />
              <div><p className="font-medium text-gray-900">{product.seller.name}</p><p className="text-sm text-gray-500">{product.salesCount} vente(s) · ★ {product.rating.toFixed(1)}</p></div>
            </div>
          </Card>
        </div>
      </div>
      {checkout && (
        <CheckoutModal title={product.title} amount={product.price} currency={product.currency} onClose={() => setCheckout(false)}
          startCheckout={(gateway) => api.post(`/marketplace/products/${slug}/purchase/`, { gateway, requirements })} onCompleted={reload} />
      )}
    </div>
  );
};

export const Marketplace: React.FC = () => {
  const { authState } = useAuth();
  const isSeller = authState.user?.role === 'FORMATEUR' || authState.user?.role === 'ADMIN';
  const [tab, setTab] = useState<'browse' | 'sell'>('browse');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const { data, loading, error, reload } = useApi(async () => unwrap(await api.get('/marketplace/products/', { search, type })).map(mapProduct), [search, type]);

  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Templates, codes source, e-books et coaching proposés par nos formateurs" action={isSeller && (
        <div className="flex space-x-2">
          <button onClick={() => setTab('browse')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'browse' ? 'bg-primary-700 text-white shadow-sm' : 'bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50'}`}>Parcourir</button>
          <button onClick={() => setTab('sell')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'sell' ? 'bg-primary-700 text-white shadow-sm' : 'bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50'}`}>Espace vendeur</button>
        </div>
      )} />
      {tab === 'sell' ? <SellerSpace /> : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className={`${inputClass} pl-10`} />
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputClass} sm:w-56`}>
              <option value="">Tous les types</option>
              {Object.entries(PRODUCT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {error && <ErrorBox message={error} onRetry={reload} />}
          {loading ? <Spinner /> : !data?.length ? <EmptyState title="Aucun produit" /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.map((p: Product) => (
                <button key={p.id} onClick={() => navigate(`/marketplace/${p.slug}`)} className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 overflow-hidden text-left hover:shadow-md transition-shadow">
                  <img src={p.preview} alt="" className="w-full h-40 object-cover" loading="lazy" />
                  <div className="p-5">
                    <span className="text-xs font-semibold text-primary-600 uppercase">{PRODUCT_TYPES[p.type]}</span>
                    <h3 className="font-semibold text-gray-900 mt-1 line-clamp-2">{p.title}</h3>
                    <div className="flex items-center justify-between mt-3 text-sm">
                      <span className="text-gray-500">{p.seller.name}</span>
                      <span className="font-bold text-gray-900">{formatPrice(p.price, p.currency)}</span>
                    </div>
                    {p.ratingCount > 0 && <p className="text-xs text-gray-500 mt-1 flex items-center"><Star className="w-3 h-3 text-sun-400 fill-current mr-1" />{p.rating.toFixed(1)} ({p.ratingCount})</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Purchases: React.FC = () => {
  const { data, loading, error, reload } = useApi(async () => (await api.get<any[]>('/marketplace/orders/')).map(mapOrder), []);

  const complete = async (id: string) => {
    await api.post(`/marketplace/orders/${id}/complete/`);
    reload();
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="Mes achats" subtitle="Ressources téléchargeables et prestations commandées" />
      {!data?.length ? <EmptyState title="Aucun achat" action={<button className={buttonPrimary} onClick={() => navigate('/marketplace')}>Découvrir la marketplace</button>} /> : (
        <div className="bg-white rounded-2xl shadow-card ring-1 ring-gray-100 divide-y">
          {data.map((o) => (
            <div key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Package className="w-8 h-8 text-gray-400" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{o.product.title}</p>
                <p className="text-sm text-gray-500">{o.createdAt.toLocaleDateString('fr-FR')} · {formatPrice(o.amount, o.currency)} · {o.product.seller.name}</p>
                {o.deliveryMessage && <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">📦 {o.deliveryMessage}</p>}
              </div>
              <div className="flex gap-2">
                {(o.product.hasFile || o.hasDeliveryFile) && ['PAID', 'DELIVERED', 'COMPLETED'].includes(o.status) && (
                  <button onClick={() => downloadFile(`/marketplace/orders/${o.id}/download/`, o.product.slug)} className={`${buttonPrimary} flex items-center space-x-1`}><Download className="w-4 h-4" /><span>Télécharger</span></button>
                )}
                {o.status === 'DELIVERED' && <button onClick={() => complete(o.id)} className={`${buttonSecondary} flex items-center space-x-1`}><CheckCircle className="w-4 h-4" /><span>Valider la livraison</span></button>}
                {o.status === 'PAID' && !o.product.isDigital && <span className="text-sm text-sun-700 bg-sun-50 px-2 py-1 rounded">En attente de livraison</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
