
export type Category = 'pain' | 'viennoiserie' | 'patisserie' | 'snacking';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  badge?: string;
  available?: boolean; // Nouveau champ pour gérer le stock
}

export interface CartItem extends Product {
  quantity: number;
}

export type ViewState = 'home' | 'menu' | 'contact' | 'checkout-success' | 'kitchen' | 'pro-dashboard';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export type OrderStatus = 'pending' | 'ready' | 'completed';

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  isPro?: boolean; // Indique si c'est une commande pro
  proCompany?: string; // Nom de l'entreprise si pro
  items: CartItem[];
  total: number;
  status: OrderStatus;
  timestamp: string;
  pickupTime: string;
  paymentMethod: 'store' | 'card' | 'account'; // 'account' pour paiement fin de mois pro
}

export interface ProUser {
  id: string;
  companyName: string;
  siret: string;
  contactName: string;
  email: string;
  phone: string;
  password?: string; // Généré par le boulanger
  status: 'pending' | 'active';
  registrationDate: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string; // ex: Boulanger, Vendeur
  code: string; // Format: 2 lettres + 6 chiffres
  createdAt: string;
}

export interface ConnectionLog {
  id: string;
  staffName: string;
  role: string;
  loginTime: string;
  logoutTime?: string;
  duration?: string;
}
