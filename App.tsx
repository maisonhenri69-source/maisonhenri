import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, MapPin, Phone, Instagram, Facebook, Clock, Star, Menu as MenuIcon, X, ChevronRight, CheckCircle, Mail, ChefHat, Lock, KeyRound, ArrowRight, Plus, Briefcase, UserCircle, Send } from 'lucide-react';
import { products as initialProducts } from './data/products';
import { shopConfig } from './data/siteConfig';
import { CartItem, Category, ViewState, Product, ProUser, StaffMember, ConnectionLog } from './types';
import { dataService } from './services/dataService';
import CartSidebar from './components/CartSidebar';
import GeminiAdvisor from './components/GeminiAdvisor';
import KitchenDashboard from './components/KitchenDashboard';
import ProAuthModal from './components/ProAuthModal';
import ProDashboard from './components/ProDashboard';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [scrolled, setScrolled] = useState(false);
  
  // Reference for video to force play
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Product Management State (Source of Truth)
  const [shopProducts, setShopProducts] = useState<Product[]>([]);

  // States for Staff Access & Settings
  const [isKitchenLoginOpen, setIsKitchenLoginOpen] = useState(false);
  const [kitchenCodeInput, setKitchenCodeInput] = useState('');
  const [kitchenError, setKitchenError] = useState(false);
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  
  // Dynamic Settings (Staff, Logs, Settings, AdminCode)
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [customTextColor, setCustomTextColor] = useState<string>('');
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([]);
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState<boolean>(false);
  const [cardPaymentEnabled, setCardPaymentEnabled] = useState<boolean>(true);
  const [adminCode, setAdminCode] = useState<string>(shopConfig.adminCode); // Initialize with default config
  
  // States for Pro Access
  const [isProAuthOpen, setIsProAuthOpen] = useState(false);
  const [proUser, setProUser] = useState<ProUser | null>(null);

  // States for Contact Form
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);

  // Auto-Logout Timer Ref
  const logoutTimerRef = useRef<number | null>(null);

  // Initial Load (Settings & Products)
  useEffect(() => {
    // Products Load via DataService (Cloud First)
    const loadProducts = async () => {
        try {
            const products = await dataService.getProducts(initialProducts);
            setShopProducts(products);
        } catch (error) {
            console.error("Erreur chargement produits:", error);
            setShopProducts(initialProducts);
        }
    };
    loadProducts();

    // Admin Code (Load from LocalStorage or keep default)
    const savedAdminCode = localStorage.getItem('monnet_admin_code');
    if (savedAdminCode) {
        setAdminCode(savedAdminCode);
    } else {
        localStorage.setItem('monnet_admin_code', shopConfig.adminCode);
    }

    // Staff Members
    try {
        const savedStaff = localStorage.getItem('monnet_staff');
        let staffList: StaffMember[] = [];
        
        if (savedStaff) {
            staffList = JSON.parse(savedStaff);
        }

        const currentAdminCode = savedAdminCode || shopConfig.adminCode;
        const defaultAdmin = { id: '1', name: 'Administrateur', role: 'Gérant', code: currentAdminCode, createdAt: new Date().toISOString() };
        const defaultUser = { id: '2', name: 'Jean Dupont', role: 'Boulanger', code: 'JD123456', createdAt: new Date().toISOString() };

        let hasChanges = false;
        if (staffList.length === 0) { 
            staffList.push(defaultAdmin); 
            staffList.push(defaultUser);
            hasChanges = true; 
        }

        if (hasChanges || !savedStaff) {
            localStorage.setItem('monnet_staff', JSON.stringify(staffList));
        }
        setStaffMembers(staffList);
    } catch (e) {
        console.error("Error loading staff", e);
    }

    // Settings (Color, AutoLogout, Payment)
    const savedColor = localStorage.getItem('monnet_text_color');
    if (savedColor) {
      setCustomTextColor(savedColor);
      document.documentElement.style.setProperty('--text-main', savedColor);
    }

    const savedAutoLogout = localStorage.getItem('monnet_auto_logout');
    if (savedAutoLogout) {
        setAutoLogoutEnabled(JSON.parse(savedAutoLogout));
    }

    const savedCardPayment = localStorage.getItem('monnet_card_payment');
    if (savedCardPayment !== null) {
        setCardPaymentEnabled(JSON.parse(savedCardPayment));
    }

    // Logs
    const savedLogs = localStorage.getItem('monnet_connection_logs');
    if (savedLogs) setConnectionLogs(JSON.parse(savedLogs));

  }, []);

  // --- AUTO LOGOUT LOGIC ---
  const resetLogoutTimer = () => {
     if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
     if (currentUser && autoLogoutEnabled) {
         logoutTimerRef.current = window.setTimeout(() => {
             handleStaffLogout();
             alert("Déconnexion automatique pour inactivité.");
         }, 15 * 60 * 1000); 
     }
  };

  useEffect(() => {
      if (currentUser && autoLogoutEnabled) {
          window.addEventListener('mousemove', resetLogoutTimer);
          window.addEventListener('keydown', resetLogoutTimer);
          window.addEventListener('click', resetLogoutTimer);
          resetLogoutTimer(); 
      } else {
          if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      }
      return () => {
          window.removeEventListener('mousemove', resetLogoutTimer);
          window.removeEventListener('keydown', resetLogoutTimer);
          window.removeEventListener('click', resetLogoutTimer);
          if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      };
  }, [currentUser, autoLogoutEnabled]);


  // Update product handler (Cloud Aware)
  const handleUpdateProduct = async (updatedProduct: Product) => {
    try {
        await dataService.upsertProduct(updatedProduct);
        // Optimistic update
        setShopProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    } catch (e: any) {
        alert("Erreur lors de la sauvegarde du produit.");
    }
  };

  // Add product handler (Cloud Aware)
  const handleAddProduct = async (newProductData: Omit<Product, 'id'>) => {
    try {
        const maxId = shopProducts.reduce((max, p) => (p.id > max ? p.id : max), 0);
        const newProduct: Product = { 
          ...newProductData, 
          id: maxId + 1, 
          available: true 
        };
        await dataService.upsertProduct(newProduct);
        // Optimistic update
        setShopProducts(prev => [...prev, newProduct]);
    } catch (e: any) {
        alert("Erreur lors de l'ajout du produit.");
    }
  };

  // Delete product handler (Cloud Aware)
  const handleDeleteProduct = async (productId: number) => {
    try {
        await dataService.deleteProduct(productId);
        setShopProducts(prev => prev.filter(p => p.id !== productId));
        setCart(prev => prev.filter(item => item.id !== productId));
    } catch (e) {
        alert("Erreur lors de la suppression.");
    }
  };

  // Update Settings Handler
  const handleUpdateSettings = (newStaffList: StaffMember[], newColor: string, newAutoLogout: boolean, newCardPayment: boolean) => {
    setStaffMembers(newStaffList);
    localStorage.setItem('monnet_staff', JSON.stringify(newStaffList));

    setCustomTextColor(newColor);
    localStorage.setItem('monnet_text_color', newColor);
    if (newColor) document.body.style.color = newColor;
    else document.body.style.color = '';

    setAutoLogoutEnabled(newAutoLogout);
    localStorage.setItem('monnet_auto_logout', JSON.stringify(newAutoLogout));

    setCardPaymentEnabled(newCardPayment);
    localStorage.setItem('monnet_card_payment', JSON.stringify(newCardPayment));
  };

  // Update Admin Code Handler
  const handleUpdateAdminCode = (newCode: string) => {
      setAdminCode(newCode);
      localStorage.setItem('monnet_admin_code', newCode);
  };

  // Scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top when view changes and Force Video Play
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (view === 'home' && videoRef.current) {
        const videoEl = videoRef.current;
        videoEl.defaultMuted = true;
        videoEl.muted = true;
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name !== 'AbortError' && !error.message.includes('interrupted')) {
                    console.error("Autoplay prevented by browser:", error);
                }
            });
        }
    }
  }, [view]);

  // Load cart from localStorage
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('monnet_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (error) {
      setCart([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('monnet_cart', JSON.stringify(cart));
  }, [cart]);

  // Listen for custom add-to-cart events
  useEffect(() => {
    const handleCustomAdd = (e: any) => {
      addToCart(e.detail);
    };
    window.addEventListener('monnet-add-to-cart', handleCustomAdd);
    return () => window.removeEventListener('monnet-add-to-cart', handleCustomAdd);
  }, [shopProducts]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => setCart([]);

  const filteredProducts = (activeCategory === 'all' 
    ? shopProducts 
    : shopProducts.filter(p => p.category === activeCategory)
  ).filter(p => p.available !== false);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleCheckoutSuccess = () => {
    setView('checkout-success');
  };

  const handleKitchenAccess = () => {
    const inputCode = kitchenCodeInput.toUpperCase();
    
    // Check against Staff List
    let staff = staffMembers.find(s => s.code === inputCode);
    
    // Fallback: Admin Master Code
    if (!staff && inputCode === adminCode) {
        staff = { 
            id: 'master-admin', 
            name: 'Administrateur', 
            role: 'Gérant', 
            code: adminCode, 
            createdAt: new Date().toISOString() 
        };
    }

    if (staff) {
        setCurrentUser(staff);
        
        // --- LOG START ---
        const newLog: ConnectionLog = {
            id: Math.random().toString(36).substr(2, 9),
            staffName: staff.name,
            role: staff.role,
            loginTime: new Date().toISOString()
        };
        const updatedLogs = [newLog, ...connectionLogs].slice(0, 100); 
        setConnectionLogs(updatedLogs);
        localStorage.setItem('monnet_connection_logs', JSON.stringify(updatedLogs));
        // --- LOG END ---

        setView('kitchen');
        setIsKitchenLoginOpen(false);
        setKitchenCodeInput('');
        setKitchenError(false);
    } else {
        setKitchenError(true);
        setKitchenCodeInput('');
    }
  };

  const handleStaffLogout = () => {
     // --- LOG END ---
     if (currentUser && connectionLogs.length > 0) {
        const now = new Date();
        const updatedLogs = connectionLogs.map((log, index) => {
           if (index === 0 && log.staffName === currentUser.name && !log.logoutTime) {
               const login = new Date(log.loginTime);
               const diffMs = now.getTime() - login.getTime();
               const diffMins = Math.floor(diffMs / 60000);
               const hours = Math.floor(diffMins / 60);
               const mins = diffMins % 60;
               const durationStr = `${hours}h ${mins}m`;

               return { ...log, logoutTime: now.toISOString(), duration: durationStr };
           }
           return log;
        });
        setConnectionLogs(updatedLogs);
        localStorage.setItem('monnet_connection_logs', JSON.stringify(updatedLogs));
     }
     
     setCurrentUser(null);
     setView('home');
  };

  const handleProLoginSuccess = (user: ProUser) => {
    setProUser(user);
    setView('pro-dashboard');
  };

  const handleContactSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setTimeout(() => {
          setContactSent(true);
          setContactName('');
          setContactEmail('');
          setContactMessage('');
          setTimeout(() => setContactSent(false), 5000);
      }, 1000);
  };

  // --- SPECIAL VIEWS RENDERING ---

  // 1. KITCHEN VIEW (STAFF)
  if (view === 'kitchen') {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-brand-900 text-white p-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
          <div className="font-bold font-serif flex items-center gap-2">
            <span onClick={handleStaffLogout} className="cursor-pointer hover:text-brand-gold transition-colors">{shopConfig.name}</span>
            <span className="opacity-50">|</span>
            <span className="text-brand-gold uppercase tracking-widest text-sm">Espace Fournil</span>
          </div>
          <div className="flex items-center gap-4">
             {currentUser && <span className="text-xs hidden md:inline-block bg-brand-800 px-2 py-1 rounded">Connecté: {currentUser.name}</span>}
             <button onClick={handleStaffLogout} className="text-sm hover:text-brand-300 underline flex items-center gap-1"><LogOutIcon size={14}/> Déconnexion</button>
          </div>
        </div>
        <KitchenDashboard 
          currentUser={currentUser}
          products={shopProducts} 
          onUpdateProduct={handleUpdateProduct} 
          onAddProduct={handleAddProduct}
          onDeleteProduct={handleDeleteProduct}
          staffList={staffMembers}
          connectionLogs={connectionLogs}
          currentTextColor={customTextColor}
          autoLogoutEnabled={autoLogoutEnabled}
          cardPaymentEnabled={cardPaymentEnabled}
          onUpdateSettings={handleUpdateSettings}
          adminCode={adminCode}
          onUpdateAdminCode={handleUpdateAdminCode}
        />
      </div>
    );
  }

  // 2. PRO DASHBOARD VIEW (CLIENT APP)
  if (view === 'pro-dashboard' && proUser) {
    return (
      <ProDashboard 
        user={proUser}
        products={shopProducts}
        onLogout={() => { setProUser(null); setView('home'); }}
      />
    );
  }

  // 3. MAIN PUBLIC SITE
  // Apply Custom Text Color via style prop
  const mainStyle = customTextColor ? { color: customTextColor } : {};

  return (
    <div className="min-h-screen flex flex-col font-sans text-brand-900 selection:bg-brand-800 selection:text-white" style={mainStyle}>
      
      {/* Modern Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-md py-2' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center cursor-pointer group" onClick={() => setView('home')}>
              <div className={`w-10 h-10 ${scrolled ? 'bg-brand-900 text-brand-gold' : 'bg-white text-brand-900'} rounded-full flex items-center justify-center font-serif font-bold text-xl mr-3 transition-colors shadow-lg`}>M</div>
              <div className="flex flex-col">
                <h1 className={`font-serif text-xl font-bold tracking-widest uppercase ${scrolled ? 'text-brand-900' : 'text-white'} transition-colors`} style={scrolled && customTextColor ? { color: customTextColor } : {}}>{shopConfig.name}</h1>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-12">
              <div className="flex space-x-8 items-center">
                {['home', 'menu', 'contact'].map((v) => (
                  <button 
                    key={v}
                    onClick={() => setView(v as ViewState)} 
                    className={`text-xs uppercase tracking-[0.2em] font-bold transition-all hover:-translate-y-0.5 ${
                      view === v 
                        ? (scrolled ? 'text-brand-800 border-b-2 border-brand-800' : 'text-white border-b-2 border-white') 
                        : (scrolled ? 'text-gray-500 hover:text-brand-800' : 'text-white/80 hover:text-white')
                    }`}
                    style={scrolled && customTextColor ? { color: customTextColor, borderColor: view === v ? customTextColor : 'transparent' } : {}}
                  >
                    {v === 'home' ? 'Accueil' : v === 'menu' ? 'La Carte' : 'Infos'}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Side Icons & Actions */}
            <div className="flex items-center space-x-6">
              
              {/* PRO ACCESS DESKTOP BUTTON */}
              <button 
                onClick={() => setIsProAuthOpen(true)}
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 border rounded-full text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-white hover:text-brand-900 ${scrolled ? 'border-brand-900 text-brand-900' : 'border-white/50 text-white'}`}
                title="Espace Client Professionnel"
              >
                 <Briefcase size={12} />
                 Accès Pro
              </button>

              <button 
                onClick={() => setIsCartOpen(true)}
                className={`relative p-3 rounded-full transition-all group ${scrolled ? 'bg-brand-50 text-brand-900 hover:bg-brand-100' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                <ShoppingBag size={20} className="group-hover:scale-105 transition-transform" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold leading-none text-brand-900 bg-brand-gold rounded-full shadow-sm border-2 border-white">
                    {cartCount}
                  </span>
                )}
              </button>
              <button className={`md:hidden p-2 ${scrolled ? 'text-brand-900' : 'text-white'}`} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X size={24} /> : <MenuIcon size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-white/98 backdrop-blur-xl flex flex-col items-center justify-center space-y-8 animate-fadeIn md:hidden">
            <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-6 right-6 text-brand-900"><X size={32} /></button>
            
            <nav className="flex flex-col items-center gap-6">
              <button onClick={() => { setView('home'); setIsMobileMenuOpen(false)}} className="text-3xl font-serif font-bold text-brand-900 hover:text-brand-600">Accueil</button>
              <button onClick={() => { setView('menu'); setIsMobileMenuOpen(false)}} className="text-3xl font-serif font-bold text-brand-900 hover:text-brand-600">La Carte</button>
              <button onClick={() => { setView('contact'); setIsMobileMenuOpen(false)}} className="text-3xl font-serif font-bold text-brand-900 hover:text-brand-600">Contact</button>
            </nav>

            <div className="w-24 h-px bg-brand-200 my-4"></div>

            {/* Section Espace Pro Distincte Mobile */}
            <div className="flex flex-col items-center gap-4 bg-brand-50 w-full max-w-xs p-6 rounded-xl border border-brand-100">
               <h3 className="text-xs font-bold uppercase tracking-widest text-brand-400 mb-2">Espace B2B & Staff</h3>
               <button onClick={() => { setIsProAuthOpen(true); setIsMobileMenuOpen(false); }} className="w-full px-6 py-3 bg-brand-800 text-white text-xs font-bold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 shadow-lg">
                  <Briefcase size={14} /> Espace Client Pro
               </button>
               <button onClick={() => { setIsKitchenLoginOpen(true); setIsMobileMenuOpen(false); }} className="text-xs uppercase tracking-widest text-brand-500 hover:text-brand-800 flex items-center gap-2 mt-2">
                  <Lock size={12} /> Accès Fournil (Staff)
               </button>
            </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-grow">
        
        {/* VIEW: HOME */}
        {view === 'home' && (
          <>
            {/* Immersive Hero Section */}
            <div className="relative h-screen flex items-center justify-center overflow-hidden bg-brand-900">
              <div className="absolute inset-0">
                <video 
                  ref={videoRef}
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  className="w-full h-full object-cover opacity-80"
                  poster="https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?q=80&w=2070&auto=format&fit=crop"
                >
                  <source src="https://assets.mixkit.co/videos/preview/mixkit-baker-kneading-dough-in-flour-4674-large.mp4" type="video/mp4" />
                  Votre navigateur ne supporte pas la vidéo.
                </video>
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-brand-900/90"></div>
              </div>
              
              <div className="relative max-w-7xl mx-auto px-4 text-center z-10 flex flex-col items-center animate-fadeIn">
                <div className="inline-flex items-center gap-2 border border-white/30 rounded-full px-4 py-1.5 mb-8 backdrop-blur-md bg-white/5 animate-fade-in-up">
                   <Star size={12} className="text-brand-gold fill-current" />
                   <span className="text-brand-gold font-bold tracking-[0.2em] uppercase text-[10px]">Élu meilleur artisan 2024</span>
                </div>
                
                <h1 className="text-6xl md:text-8xl font-serif font-bold text-white mb-6 leading-none tracking-tight shadow-black drop-shadow-2xl animate-fade-in-up delay-100">
                  Maison<br/>Monnet
                </h1>
                
                <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-2xl font-light leading-relaxed animate-fade-in-up delay-200">
                  L'excellence de la boulangerie artisanale.<br/>
                  <span className="text-brand-gold font-serif italic">À Décines, rue Mitterrand.</span>
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md mx-auto animate-fade-in-up delay-300">
                  <button 
                    onClick={() => setView('menu')}
                    className="flex-1 py-4 bg-brand-gold text-brand-900 font-bold tracking-widest uppercase text-xs hover:bg-white hover:scale-105 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] rounded-sm flex items-center justify-center gap-2"
                  >
                    Click & Collect <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              
              {/* Scroll Indicator */}
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce text-white/50">
                <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
                  <div className="w-1 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Info Bar */}
            <div className="bg-brand-900 text-white py-4 border-b border-brand-800">
               <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-xs uppercase tracking-widest gap-4">
                  <div className="flex items-center gap-2">
                     <Clock size={14} className="text-brand-gold" />
                     <span>Ouvert aujourd'hui : {shopConfig.hours.week}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <MapPin size={14} className="text-brand-gold" />
                     <span>{shopConfig.address}, {shopConfig.city}</span>
                  </div>
               </div>
            </div>

            {/* Showcase Section */}
            <div className="py-24 bg-white relative">
               <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                 <div className="grid md:grid-cols-2 gap-16 items-center">
                   <div className="space-y-8">
                     <h2 className="text-4xl md:text-5xl font-serif font-bold text-brand-900 leading-tight" style={customTextColor ? { color: customTextColor } : {}}>
                       Le goût authentique du <span className="italic text-brand-600 border-b-2 border-brand-gold">Vrai Pain.</span>
                     </h2>
                     <p className="text-gray-600 text-lg font-light leading-relaxed">
                       Chez Maison Monnet, nous ne faisons aucun compromis. Farines Label Rouge, levain liquide maison entretenu depuis 1998, et fermentations longues (24h minimum).
                     </p>
                     <div className="grid grid-cols-2 gap-8">
                        <div>
                           <h3 className="font-bold text-brand-900 text-lg mb-2" style={customTextColor ? { color: customTextColor } : {}}>100% Fait Maison</h3>
                           <p className="text-sm text-gray-500">Pas de surgelé. Tout est pétri, façonné et cuit ici, à Décines.</p>
                        </div>
                        <div>
                           <h3 className="font-bold text-brand-900 text-lg mb-2" style={customTextColor ? { color: customTextColor } : {}}>Ingrédients Nobles</h3>
                           <p className="text-sm text-gray-500">Beurre AOP Charentes-Poitou, Chocolat Valrhona, Farine CRC.</p>
                        </div>
                     </div>
                     <button onClick={() => setView('menu')} className="text-brand-800 font-bold uppercase tracking-widest text-xs border-b border-brand-800 pb-1 hover:text-brand-600 hover:border-brand-600 transition-colors">
                        Découvrir nos créations
                     </button>
                   </div>
                   <div className="relative">
                      <img src="https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=800&q=80" className="rounded-sm shadow-2xl w-full z-10 relative" alt="Pain" />
                      <div className="absolute -bottom-6 -left-6 w-48 h-48 bg-brand-100 -z-0"></div>
                      <div className="absolute -top-6 -right-6 w-48 h-48 border-2 border-brand-gold -z-0"></div>
                   </div>
                 </div>
               </div>
            </div>

            {/* Bestsellers */}
            <div className="bg-brand-50 py-24">
              <div className="max-w-7xl mx-auto px-4 text-center mb-16">
                 <span className="text-brand-600 font-bold uppercase tracking-widest text-xs">Les incontournables</span>
                 <h2 className="text-4xl font-serif font-bold text-brand-900 mt-2" style={customTextColor ? { color: customTextColor } : {}}>Nos Clients Adorent</h2>
              </div>
              
              <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-8">
                {shopProducts.slice(0, 3).map(product => (
                  <div key={product.id} className="group bg-white p-4 rounded-xl shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col items-center text-center">
                     <div className="w-48 h-48 rounded-full overflow-hidden mb-6 shadow-lg group-hover:scale-105 transition-transform duration-500 border-4 border-white">
                        <img src={product.image} className="w-full h-full object-cover" alt={product.name} />
                     </div>
                     <h3 className="font-serif font-bold text-xl text-brand-900 mb-2" style={customTextColor ? { color: customTextColor } : {}}>{product.name}</h3>
                     <p className="text-gray-500 text-sm mb-4 line-clamp-2">{product.description}</p>
                     <div className="mt-auto flex items-center gap-4">
                        <span className="font-bold text-brand-600 text-lg">{product.price.toFixed(2)}€</span>
                        <button 
                           onClick={() => addToCart(product)}
                           className="w-10 h-10 rounded-full bg-brand-900 text-white flex items-center justify-center hover:bg-brand-700 transition-colors shadow-md"
                        >
                           <ShoppingBag size={18} />
                        </button>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* VIEW: MENU */}
        {view === 'menu' && (
          <div className="bg-gray-50 min-h-screen pt-24 pb-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              <div className="text-center mb-12">
                <h1 className="font-serif text-5xl font-bold text-brand-900 mb-4" style={customTextColor ? { color: customTextColor } : {}}>La Carte</h1>
                <p className="text-gray-500 font-light max-w-2xl mx-auto">Commandez en ligne, récupérez au fournil sans faire la queue. Fraîcheur garantie.</p>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap justify-center gap-3 mb-16 sticky top-24 z-30 bg-gray-50/95 backdrop-blur py-4 transition-all">
                 {[
                   { id: 'all', label: 'Tout' },
                   { id: 'pain', label: 'Boulangerie' },
                   { id: 'viennoiserie', label: 'Viennoiseries' },
                   { id: 'patisserie', label: 'Pâtisseries' },
                   { id: 'snacking', label: 'Snacking' },
                 ].map(cat => (
                   <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id as Category | 'all')}
                    className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border ${
                      activeCategory === cat.id 
                      ? 'bg-brand-900 text-white border-brand-900 shadow-lg scale-105' 
                      : 'bg-white text-gray-500 border-gray-200 hover:border-brand-300'
                    }`}
                   >
                     {cat.label}
                   </button>
                 ))}
              </div>

              {/* Product Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
                {filteredProducts.map(product => (
                  <div key={product.id} className="group relative">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-gray-200 mb-4 shadow-md">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                      />
                      {/* Overlay Button */}
                      <button 
                         onClick={() => addToCart(product)}
                         className="absolute bottom-4 right-4 w-12 h-12 bg-white text-brand-900 rounded-full shadow-xl flex items-center justify-center translate-y-20 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:bg-brand-gold hover:text-white"
                      >
                         <Plus size={24} />
                      </button>
                      
                      {product.badge && (
                        <div className="absolute top-3 left-3 bg-brand-gold text-brand-900 text-[10px] font-bold px-2 py-1 uppercase tracking-wider rounded-sm shadow-sm">
                          {product.badge}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-start">
                       <div>
                          <h3 className="font-serif font-bold text-lg text-gray-900 leading-tight mb-1 group-hover:text-brand-700 transition-colors" style={customTextColor ? { color: customTextColor } : {}}>{product.name}</h3>
                          <p className="text-xs text-gray-500 line-clamp-2 mb-2">{product.description}</p>
                       </div>
                       <span className="font-bold text-brand-900 text-lg" style={customTextColor ? { color: customTextColor } : {}}>{product.price.toFixed(2)}€</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: CONTACT */}
        {view === 'contact' && (
          <div className="bg-white pt-24 pb-20">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
               <div className="grid md:grid-cols-2 gap-12 lg:gap-24 items-start">
                 
                 <div className="space-y-12">
                   <div>
                     <span className="text-brand-600 font-bold uppercase tracking-widest text-xs">Venir nous voir</span>
                     <h2 className="text-5xl font-serif font-bold text-brand-900 mt-2 mb-6" style={customTextColor ? { color: customTextColor } : {}}>Maison Monnet</h2>
                     <p className="text-gray-600 text-lg font-light leading-relaxed border-l-4 border-brand-gold pl-6">
                       Située en plein cœur de Décines, sur la place François Mitterrand, notre boulangerie est un lieu de vie et de gourmandise.
                     </p>
                   </div>

                   <div className="grid gap-8">
                     <div className="flex gap-4">
                        <MapPin size={24} className="text-brand-500 mt-1 flex-shrink-0" />
                        <div>
                           <h3 className="font-bold text-gray-900" style={customTextColor ? { color: customTextColor } : {}}>Adresse</h3>
                           <p className="text-gray-600">{shopConfig.address}<br/>{shopConfig.city}</p>
                           <a href={shopConfig.mapUrl} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-brand-600 mt-2 inline-block hover:underline">Itinéraire Google Maps</a>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <Phone size={24} className="text-brand-500 mt-1 flex-shrink-0" />
                        <div>
                           <h3 className="font-bold text-gray-900" style={customTextColor ? { color: customTextColor } : {}}>Appelez-nous</h3>
                           <p className="text-gray-600">{shopConfig.phone}</p>
                           <p className="text-xs text-gray-400 mt-1">Commandes spéciales par téléphone acceptées</p>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <Clock size={24} className="text-brand-500 mt-1 flex-shrink-0" />
                        <div>
                           <h3 className="font-bold text-gray-900" style={customTextColor ? { color: customTextColor } : {}}>Horaires</h3>
                           <div className="grid grid-cols-2 gap-x-8 text-sm text-gray-600 mt-2">
                              <span>Lun - Sam</span>
                              <span className="font-bold">{shopConfig.hours.week}</span>
                              <span>Dimanche</span>
                              <span className="font-bold">{shopConfig.hours.sunday}</span>
                           </div>
                        </div>
                     </div>
                   </div>

                   {/* FORMULAIRE DE CONTACT AJOUTÉ ICI */}
                   <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                       <h3 className="font-bold text-brand-900 text-lg mb-4 flex items-center gap-2"><Mail size={18}/> Envoyer un message</h3>
                       {contactSent ? (
                           <div className="bg-green-100 text-green-800 p-4 rounded-lg flex items-center gap-2 font-bold animate-fadeIn">
                               <CheckCircle size={20}/> Message envoyé avec succès !
                           </div>
                       ) : (
                           <form onSubmit={handleContactSubmit} className="space-y-4">
                               <input 
                                 type="text" 
                                 required
                                 placeholder="Votre nom" 
                                 value={contactName} 
                                 onChange={e => setContactName(e.target.value)}
                                 className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                               />
                               <input 
                                 type="email" 
                                 required
                                 placeholder="Votre email" 
                                 value={contactEmail} 
                                 onChange={e => setContactEmail(e.target.value)}
                                 className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                               />
                               <textarea 
                                 required
                                 rows={3}
                                 placeholder="Votre message..."
                                 value={contactMessage}
                                 onChange={e => setContactMessage(e.target.value)}
                                 className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm resize-none"
                               />
                               <button type="submit" className="w-full bg-brand-900 text-white font-bold uppercase tracking-widest text-xs py-3 rounded-lg hover:bg-brand-800 transition-colors flex items-center justify-center gap-2">
                                   Envoyer <Send size={14}/>
                               </button>
                           </form>
                       )}
                   </div>

                 </div>
                 
                 <div className="h-[600px] w-full bg-gray-100 rounded-2xl overflow-hidden shadow-2xl relative">
                    <iframe 
                      src={`https://maps.google.com/maps?q=${encodeURIComponent("Boulangerie Maison Monnet " + shopConfig.address + " " + shopConfig.city)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      width="100%" 
                      height="100%" 
                      style={{border:0}} 
                      loading="lazy" 
                      className="filter grayscale hover:grayscale-0 transition-all duration-700"
                    ></iframe>
                    <div className="absolute bottom-8 left-8 bg-white p-6 rounded-lg shadow-xl max-w-xs">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                           <span className="text-xs font-bold uppercase text-green-700">Ouvert maintenant</span>
                        </div>
                        <p className="text-sm text-gray-600">Le stationnement est facile devant la boutique (Zone bleue).</p>
                    </div>
                 </div>

               </div>
             </div>
          </div>
        )}

        {/* VIEW: CHECKOUT SUCCESS */}
        {view === 'checkout-success' && (
          <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4 text-center">
            <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-8 animate-bounce shadow-xl">
              <CheckCircle size={64} />
            </div>
            <h2 className="text-5xl font-serif font-bold text-brand-900 mb-4" style={customTextColor ? { color: customTextColor } : {}}>Merci !</h2>
            <p className="text-xl text-gray-600 max-w-lg mb-10 font-light leading-relaxed">
              Votre commande est confirmée. <br/>
              Nos artisans préparent vos produits avec soin.
            </p>
            <div className="bg-brand-50 p-6 rounded-lg border border-brand-100 mb-10 w-full max-w-md">
               <h3 className="font-bold text-brand-900 mb-2 uppercase tracking-widest text-xs" style={customTextColor ? { color: customTextColor } : {}}>Prochaines étapes</h3>
               <ul className="text-left space-y-3 text-sm text-gray-600">
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-brand-200 text-brand-800 flex items-center justify-center font-bold text-xs">1</span> Rendez-vous au 4 place François Mitterrand</li>
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-brand-200 text-brand-800 flex items-center justify-center font-bold text-xs">2</span> Dirigez-vous vers la file "Click & Collect"</li>
                  <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-brand-200 text-brand-800 flex items-center justify-center font-bold text-xs">3</span> Donnez votre nom pour récupérer votre sac</li>
               </ul>
            </div>
            <button 
              onClick={() => setView('home')} 
              className="px-12 py-4 bg-brand-900 text-white rounded-full hover:bg-brand-800 transition-all font-bold uppercase tracking-widest text-xs shadow-lg hover:shadow-2xl hover:-translate-y-1"
            >
              Retour à l'accueil
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="bg-brand-900 text-white pt-24 pb-12 border-t border-brand-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-brand-900 font-serif font-bold text-xl mb-6">M</div>
              <h3 className="font-serif text-3xl font-bold text-white mb-6 tracking-wide">Maison Monnet</h3>
              <p className="text-brand-200 mb-8 max-w-sm font-light leading-relaxed opacity-80">
                L'artisanat est notre passion. La qualité est notre devoir. Depuis plus de 20 ans à Décines.
              </p>
              <div className="flex gap-4">
                 <a href="#" className="w-10 h-10 rounded-full border border-brand-700 flex items-center justify-center hover:bg-white hover:text-brand-900 transition-all"><Instagram size={18}/></a>
                 <a href="#" className="w-10 h-10 rounded-full border border-brand-700 flex items-center justify-center hover:bg-white hover:text-brand-900 transition-all"><Facebook size={18}/></a>
                 <a href="#" className="w-10 h-10 rounded-full border border-brand-700 flex items-center justify-center hover:bg-white hover:text-brand-900 transition-all"><Mail size={18}/></a>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-brand-500 mb-8">Navigation</h4>
              <ul className="space-y-4 text-brand-100 text-sm opacity-80">
                <li><button onClick={() => setView('menu')} className="hover:text-white hover:translate-x-1 transition-all inline-block">Nos Produits</button></li>
                <li><button onClick={() => setView('contact')} className="hover:text-white hover:translate-x-1 transition-all inline-block">Contact & Accès</button></li>
                <li><button onClick={() => setIsProAuthOpen(true)} className="hover:text-white hover:translate-x-1 transition-all inline-block flex items-center gap-2"><Briefcase size={14} /> Espace Client Pro</button></li>
                <li><button onClick={() => setIsKitchenLoginOpen(true)} className="hover:text-white hover:translate-x-1 transition-all inline-block flex items-center gap-2"><Lock size={14} /> Accès Staff</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-brand-500 mb-8">Nous trouver</h4>
              <p className="text-brand-100 text-sm leading-loose opacity-80">
                4 place François Mitterrand<br/>
                69150 DÉCINES-CHARPIEU<br/>
                <span className="block mt-4 text-white font-bold">{shopConfig.phone}</span>
              </p>
            </div>
          </div>
          
          <div className="border-t border-brand-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-brand-500 gap-4">
            <p>&copy; {new Date().getFullYear()} Boulangerie Monnet. Tous droits réservés.</p>
            <div className="flex items-center gap-2">
               <span>Fait avec amour à Lyon</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Security Modal for Kitchen Access (Staff) */}
      {isKitchenLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setIsKitchenLoginOpen(false)}></div>
           <div className="bg-white rounded-lg shadow-2xl p-8 relative z-10 w-full max-w-sm animate-fade-in-up border border-brand-200">
              <button onClick={() => setIsKitchenLoginOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-brand-900">
                <X size={20} />
              </button>
              <div className="text-center mb-6">
                 <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-800">
                    <KeyRound size={32} />
                 </div>
                 <h3 className="font-serif font-bold text-xl text-brand-900">Accès Équipe</h3>
                 <p className="text-sm text-gray-500 mt-1">Saisissez votre code personnel (2 lettres + 6 chiffres)</p>
              </div>
              <input 
                autoFocus
                type="password" 
                value={kitchenCodeInput}
                onChange={(e) => setKitchenCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleKitchenAccess()}
                className="w-full text-center tracking-[0.5em] text-lg font-bold py-3 border-b-2 border-brand-200 focus:border-brand-800 outline-none mb-6 text-brand-900 bg-transparent uppercase"
                placeholder="AB123456"
                maxLength={8}
              />
              {kitchenError && (
                 <p className="text-red-500 text-xs text-center mb-4 font-bold uppercase animate-pulse">Code Non Reconnu</p>
              )}
              <button 
                onClick={handleKitchenAccess}
                className="w-full py-4 bg-brand-900 text-white font-bold uppercase tracking-widest text-sm rounded-sm hover:bg-brand-800 transition-colors"
              >
                Identification
              </button>
           </div>
        </div>
      )}

      {/* Pro Auth Modal (Client) */}
      <ProAuthModal 
        isOpen={isProAuthOpen} 
        onClose={() => setIsProAuthOpen(false)}
        onLoginSuccess={handleProLoginSuccess}
      />

      {/* Cart Sidebar */}
      <CartSidebar 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cart={cart}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
        clearCart={clearCart}
        onCheckoutSuccess={handleCheckoutSuccess}
        availableProducts={shopProducts}
        cardPaymentEnabled={cardPaymentEnabled}
      />
      
      {/* AI Advisor Chat */}
      <GeminiAdvisor />

    </div>
  );
};

const LogOutIcon: React.FC<{size?: number}> = ({size=24}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);

export default App;