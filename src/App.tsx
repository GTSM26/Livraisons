/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { 
  LayoutDashboard, 
  Truck, 
  Package, 
  Search, 
  Filter, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight,
  Calculator,
  Calendar,
  MapPin,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Building2,
  Menu,
  X,
  Navigation,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logData as initialData, DeliveryData } from './data';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fetchLogisticsData, type OperationType } from './services/dataService';
import { generateBCD, generateExtractionPDF } from './services/pdfService';
import { RefreshCw, Globe, ArrowLeftRight } from 'lucide-react';

// BCD Registry Key
const BCD_STORAGE_KEY = 'gtsm_bcd_registry';
const OP_TYPE_KEY = 'gtsm_operation_type';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1'];

// --- Components ---

const StatCard = ({ title, value, subValue, icon: Icon, trend, prefix = "", suffix = "" }: { 
  title: string; 
  value: string | number; 
  subValue?: string; 
  icon: any; 
  trend?: number;
  prefix?: string;
  suffix?: string;
}) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-slate-100 rounded-xl">
        <Icon className="w-6 h-6 text-slate-600" />
      </div>
      {trend !== undefined && (
        <span className={cn(
          "flex items-center text-xs font-semibold px-2 py-1 rounded-full",
          trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {trend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-slate-900">{prefix}{value}{suffix}</h3>
        {subValue && <span className="text-xs text-slate-400">{subValue}</span>}
      </div>
    </div>
  </motion.div>
);

export default function App() {
  const [operationType, setOperationType] = useState<OperationType>(() => {
    return (localStorage.getItem(OP_TYPE_KEY) as OperationType) || 'import';
  });
  const [data, setData] = useState<DeliveryData[]>(initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'analytics' | 'tours'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [carrierFilter, setCarrierFilter] = useState<string>('all');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateTypeFilter, setDateTypeFilter] = useState<'depotage' | 'sortie'>('sortie');
  const [voyageFilter, setVoyageFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');

  // BCD Registry state
  const [bcdRegistry, setBcdRegistry] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(BCD_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  // Save operation type to localStorage
  useEffect(() => {
    localStorage.setItem(OP_TYPE_KEY, operationType);
  }, [operationType]);

  // Function to get or create a BCD number for a tour
  const getBcdNumberForTour = (tourNo: string, date: string, carrier: string) => {
    // Unique key identifying the specific tour (Carrier + Date + TourNo + OpType)
    const tourKey = `${operationType}_${carrier}_${date}_${tourNo}`.replace(/\s+/g, '_');
    
    if (bcdRegistry[tourKey]) {
      return bcdRegistry[tourKey];
    }

    // Generate new BCD if not exists
    const year = new Date().getFullYear();
    const uniqueId = Math.floor(Math.random() * 900) + 100;
    const prefix = operationType === 'import' ? 'BCD' : 'BCE';
    const newBcd = `${prefix}-${year}-${tourNo.padStart(3, '0')}-${uniqueId}`;
    
    const newRegistry = { ...bcdRegistry, [tourKey]: newBcd };
    setBcdRegistry(newRegistry);
    localStorage.setItem(BCD_STORAGE_KEY, JSON.stringify(newRegistry));
    
    return newBcd;
  };

  // --- Sync Logic ---

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const freshData = await fetchLogisticsData(operationType);
      if (freshData && freshData.length > 0) {
        setData(freshData);
        setLastSync(new Date());
      } else {
        // En cas de données vides, on évite de bloquer sur les anciennes
        setData([]);
      }
    } catch (error) {
      console.error("Failed to sync data:", error);
      // Optionnel: on peut vider les données en cas d'erreur réseau pour éviter la confusion
      setData([]);
    } finally {
      setIsSyncing(false);
    }
  };

  // Reset data and filters when switching mode
  useEffect(() => {
    setData([]); // On vide pour montrer que le chargement est en cours
    setSelectedCarrier(null);
    setCarrierFilter('all');
    handleSync();
  }, [operationType]);

  useEffect(() => {
    // Auto-sync every 5 minutes
    const interval = setInterval(handleSync, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [operationType]);

  // --- Helpers ---

  const parseDate = (dateStr: string) => {
    if (!dateStr || dateStr === '/') return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    return new Date(y, m - 1, d).getTime();
  };

  const getMonthFromDate = (dateStr: string) => {
    if (!dateStr || dateStr === '/') return '';
    const parts = dateStr.split('/');
    if (parts.length < 2) return '';
    const m = parseInt(parts[1]);
    const months = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return months[m] || '';
  };

  // --- Data Processing ---

  const sortedCarriers = useMemo(() => {
    const carriers = Array.from(new Set(data.map(d => d.transporteur?.trim()))).filter(Boolean);
    return (carriers as string[]).sort();
  }, [data]);

  const carrierStats = useMemo(() => {
    if (!selectedCarrier) return null;
    const carrierData = data.filter(d => d.transporteur?.trim() === selectedCarrier.trim());
    const totalOps = carrierData.length;
    const totalWeight = carrierData.reduce((acc, curr) => acc + curr.poids, 0);
    const totalCost = carrierData.reduce((acc, curr) => acc + curr.prixHT, 0);
    
    // Group by date for the timeline
    const timelineMap: Record<string, { date: string; ops: number; weight: number; cost: number }> = {};
    carrierData.forEach(d => {
      const dateKey = d.dateDepotage;
      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = { date: dateKey, ops: 0, weight: 0, cost: 0 };
      }
      timelineMap[dateKey].ops += 1;
      timelineMap[dateKey].weight += d.poids;
      timelineMap[dateKey].cost += d.prixHT;
    });

    const timeline = Object.values(timelineMap).sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('-'));
      const dateB = new Date(b.date.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });

    return { totalOps, totalWeight, totalCost, timeline };
  }, [selectedCarrier, data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = item.destinataire.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.expediteur.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.transporteur.toLowerCase().includes(searchTerm.toLowerCase());
      
      const itemMonth = getMonthFromDate(item.dateDepotage);
      const matchMonth = monthFilter === 'all' || itemMonth === monthFilter.toLowerCase();
      
      const matchCarrier = carrierFilter === 'all' || item.transporteur === carrierFilter;

      let matchPeriod = true;
      const dateToCompare = dateTypeFilter === 'depotage' ? item.dateDepotage : item.dateSortie;
      
      if (startDate || endDate) {
        const itemTime = parseDate(dateToCompare);
        if (itemTime) {
          if (startDate) {
            const startTime = new Date(startDate).getTime();
            if (itemTime < startTime) matchPeriod = false;
          }
          if (endDate) {
            const endTime = new Date(endDate).getTime();
            if (itemTime > endTime) matchPeriod = false;
          }
        } else if (startDate || endDate) {
          matchPeriod = false;
        }
      }

      const matchVoyage = voyageFilter === '' || item.voyage.toLowerCase().includes(voyageFilter.toLowerCase());
      const matchPosition = positionFilter === '' || item.position.toString().toLowerCase().includes(positionFilter.toLowerCase());
      
      return matchSearch && matchMonth && matchCarrier && matchPeriod && matchVoyage && matchPosition;
    });
  }, [searchTerm, monthFilter, carrierFilter, startDate, endDate, dateTypeFilter, voyageFilter, positionFilter, data]);

  const kpis = useMemo(() => {
    const totalWeight = filteredData.reduce((acc, curr) => acc + curr.poids, 0);
    const totalCost = filteredData.reduce((acc, curr) => acc + curr.prixHT, 0);
    const totalColis = filteredData.reduce((acc, curr) => acc + curr.nbreColis, 0);
    const avgPricePerKg = totalWeight > 0 ? (totalCost / totalWeight).toFixed(2) : 0;

    return { totalWeight, totalCost, totalColis, avgPricePerKg };
  }, [filteredData]);

  const transportData = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredData.forEach(item => {
      const name = item.transporteur?.trim();
      if (name) {
        groups[name] = (groups[name] || 0) + item.poids;
      }
    });
    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const zoneData = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredData.forEach(item => {
      const name = item.zone?.trim();
      if (name) {
        groups[name] = (groups[name] || 0) + 1;
      }
    });
    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const monthlyTrend = useMemo(() => {
    const series = filteredData.reduce((acc, curr) => {
      const week = `S${curr.semaine}`;
      if (!acc[week]) acc[week] = { week, cost: 0, weight: 0 };
      acc[week].cost += curr.prixHT;
      acc[week].weight += curr.poids;
      return acc;
    }, {} as Record<string, { week: string; cost: number; weight: number }>);
    return (Object.values(series) as { week: string; cost: number; weight: number }[]).sort((a, b) => a.week.localeCompare(b.week));
  }, [filteredData]);

  const pendingLots = useMemo(() => {
    return data.filter(d => d.status !== 'Livré').sort((a, b) => {
      const dateA = parseDate(a.dateDepotage) || 0;
      const dateB = parseDate(b.dateDepotage) || 0;
      return Number(dateB) - Number(dateA); // Plus récents d'abord
    });
  }, [data]);

  const groupedTours = useMemo(() => {
    const normalize = (str: string) => 
      str.toLowerCase()
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .trim();

    const toursMap: Record<string, Record<string, Record<string, Record<number, DeliveryData[]>>>> = {};
    
    filteredData.forEach(item => {
      const itemType = item.typeLivraison || "AUTRE";
      if (deliveryTypeFilter !== 'all') {
        if (normalize(itemType) !== normalize(deliveryTypeFilter)) return;
      }
      const typeKey = itemType;
      const t = item.transporteur;
      const d = dateTypeFilter === 'depotage' ? item.dateDepotage : item.dateSortie;
      const tourNo = item.tourne || 1;
      if (!toursMap[typeKey]) toursMap[typeKey] = {};
      if (!toursMap[typeKey][t]) toursMap[typeKey][t] = {};
      if (!toursMap[typeKey][t][d]) toursMap[typeKey][t][d] = {};
      if (!toursMap[typeKey][t][d][tourNo]) toursMap[typeKey][t][d][tourNo] = [];
      toursMap[typeKey][t][d][tourNo].push(item);
    });
    return toursMap;
  }, [filteredData, deliveryTypeFilter, dateTypeFilter]);

  const handleExportCSV = () => {
    const exportData: any[] = [];
    
    Object.entries(groupedTours).forEach(([type, carriers]) => {
      Object.entries(carriers).forEach(([carrierName, dates]) => {
        Object.entries(dates).forEach(([date, tours]) => {
          Object.entries(tours).forEach(([tourNo, items]) => {
            const tourTotalCost = items.reduce((sum, i) => sum + i.prixHT, 0);
            
            items.forEach(item => {
              exportData.push({
                "Type de Livraison": type,
                "Date": date,
                "Tournée #": tourNo,
                "Transporteur": carrierName,
                "Véhicule": item.nVehicule || "—",
                "Zone": item.zone,
                "Expéditeur": item.expediteur,
                "Destinataire": item.destinataire,
                "Voyage": item.voyage,
                "Position": item.position,
                "Nbr Colis": item.nbreColis,
                "Poids (kg)": item.poids,
                "Prix Lot HT (MAD)": item.prixHT,
                "Prix Total Tournée HT (MAD)": tourTotalCost
              });
            });
          });
        });
      });
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `extractions_tournees_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    generateExtractionPDF(groupedTours, {
      carrier: carrierFilter,
      month: monthFilter,
      startDate: startDate,
      endDate: endDate
    });
  };

  // --- Render Helpers ---

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Mobile Toggle */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg border border-slate-200"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transition-transform duration-300 lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6">
          <div className="flex flex-col gap-1 mb-10 border-l-4 border-[#ffcb05] pl-4">
            <h1 className="text-xl font-black tracking-tighter text-white">GTSM-Tanger</h1>
            <p className="text-[10px] text-[#ffcb05] uppercase font-black tracking-widest leading-none">
              {operationType === 'import' ? 'Livraisons Import' : 'Ramassages Export'}
            </p>
          </div>

          <nav className="space-y-1">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => {setActiveTab('dashboard'); setSidebarOpen(false);}}
              icon={LayoutDashboard} 
              label="Tableau de Bord" 
            />
            <NavItem 
              active={activeTab === 'list'} 
              onClick={() => {setActiveTab('list'); setSidebarOpen(false);}}
              icon={Truck} 
              label="Livraisons" 
            />
            <NavItem 
              active={activeTab === 'analytics'} 
              onClick={() => {setActiveTab('analytics'); setSidebarOpen(false);}}
              icon={TrendingUp} 
              label="Analyses" 
            />
            <NavItem 
              active={activeTab === 'tours'} 
              onClick={() => {setActiveTab('tours'); setSidebarOpen(false);}}
              icon={Navigation} 
              label="Tournées" 
            />
          </nav>
        </div>

        <div className="absolute bottom-0 w-full p-6 bg-slate-950/50">
          <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">AA</div>
            <div>
              <p className="text-xs font-semibold">User Admin</p>
              <p className="text-[10px] text-slate-400">Logistics Manager</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl mr-4">
              <button 
                onClick={() => setOperationType('import')}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
                  operationType === 'import' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                Import
              </button>
              <button 
                onClick={() => setOperationType('export')}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
                  operationType === 'export' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={`Rechercher ${operationType === 'import' ? 'destinataire' : 'expéditeur'}...`}
                className="w-full bg-slate-100 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end mr-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dernière Sync ({operationType})</p>
              <p className="text-[10px] text-slate-500">{lastSync ? lastSync.toLocaleTimeString() : 'En attente...'}</p>
            </div>
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className={cn(
                "p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all",
                isSyncing && "animate-spin text-indigo-600"
              )}
              title={`Synchroniser ${operationType} avec Google Sheets`}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select 
                className="bg-transparent border-none text-xs font-medium focus:ring-0 cursor-pointer"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                <option value="all">Tous les mois</option>
                <option value="mars">Mars</option>
                <option value="avril">Avril</option>
              </select>
            </div>
            <a 
              href={operationType === 'import' 
                ? "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdvPPg-o1ppWAbxeJ_2PRFRIiHPFQq8UCfMsGMkT7zMxY-bQcln5a06VQ2EQo9Tg/pub?output=csv"
                : `https://docs.google.com/spreadsheets/d/e/2PACX-1vQdvPPg-o1ppWAbxeJ_2PRFRIiHPFQq8UCfMsGMkT7zMxY-bQcln5a06VQ2EQo9Tg/pub?gid=1895360170&single=true&output=csv`
              }
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              title="Télécharger le fichier source (CSV)"
            >
              <Download className="w-5 h-5" />
            </a>
          </div>
        </header>

        {/* Dynamic View */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Outstanding Deliveries Section (Moved to TOP) */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h4 className="font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Package className="w-4 h-4 text-indigo-600" />
                        Lots en attente de livraison
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Status des expéditions non soldées</p>
                    </div>
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full border border-amber-200 uppercase tracking-widest">
                      {pendingLots.length} En cours
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/30">
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Date Dépotage</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Réf / Pos</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Expéditeur / Destinataire</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Colis (Nbr/Type)</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">MPL</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 text-right">Poids / Zone</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Déclaration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingLots.length > 0 ? (
                          pendingLots.map((item, idx) => (
                            <tr key={idx} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-none">
                              <td className="p-4 align-top">
                                <p className="text-xs font-black text-slate-900">{item.dateDepotage}</p>
                              </td>
                              <td className="p-4 align-top">
                                <p className="text-[10px] font-mono font-bold text-slate-600">{item.voyage}</p>
                                <p className="text-[9px] font-mono text-slate-400 mt-0.5">{item.position}</p>
                              </td>
                              <td className="p-4 align-top">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-slate-900 uppercase tracking-tight truncate max-w-[150px]">{item.destinataire}</span>
                                  <span className="text-[10px] font-bold text-slate-400 truncate max-w-[150px] italic">{item.expediteur}</span>
                                </div>
                              </td>
                              <td className="p-4 align-top">
                                <span className="text-xs font-black text-slate-700">{item.nbreColis}</span>
                                <span className="text-[9px] text-slate-400 font-bold ml-1 uppercase">{item.typeColis}</span>
                              </td>
                              <td className="p-4 align-top text-xs font-bold text-slate-600">
                                {item.mpl}
                              </td>
                              <td className="p-4 align-top text-right">
                                <p className="text-xs font-black text-slate-900">{item.poids.toLocaleString()} <span className="text-[10px] opacity-50">kg</span></p>
                                <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-1 italic">{item.zone}</p>
                              </td>
                              <td className="p-4 align-top">
                                {(() => {
                                  const decl = (item.declaration || "").toUpperCase();
                                  let bgColor = "bg-slate-100";
                                  let textColor = "text-slate-600";
                                  let borderColor = "border-slate-200";

                                  if (decl.includes("SOUS DOUANE")) {
                                    bgColor = "bg-red-50";
                                    textColor = "text-red-700";
                                    borderColor = "border-red-100";
                                  } else if (decl.includes("DUM")) {
                                    bgColor = "bg-orange-50";
                                    textColor = "text-orange-700";
                                    borderColor = "border-orange-100";
                                  } else if (decl.includes("MLV")) {
                                    bgColor = "bg-emerald-50";
                                    textColor = "text-emerald-700";
                                    borderColor = "border-emerald-100";
                                  }

                                  return (
                                    <span className={cn(
                                      "inline-flex items-center px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                      bgColor, textColor, borderColor
                                    )}>
                                      {item.declaration || "N/A"}
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-12 text-center text-slate-400 italic text-sm">
                              Toutes les livraisons sont à jour.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    title="Poids Total" 
                    value={kpis.totalWeight.toLocaleString()} 
                    subValue="kg"
                    icon={Package} 
                    trend={12}
                  />
                  <StatCard 
                    title="Frais Transport (HT)" 
                    value={kpis.totalCost.toLocaleString()} 
                    icon={CreditCard} 
                    suffix=" MAD"
                    trend={-5}
                  />
                  <StatCard 
                    title="Total Colis" 
                    value={kpis.totalColis} 
                    icon={Calculator} 
                    trend={8}
                  />
                  <StatCard 
                    title="Prix Moyen/kg" 
                    value={kpis.avgPricePerKg} 
                    icon={TrendingUp} 
                    suffix=" MAD"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Chart 1: Poids par Transporteur */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-bold text-slate-800">Poids par Transporteur (kg)</h4>
                      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Global</div>
                    </div>
                    <div className="h-64">
                      {transportData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                          <BarChart data={transportData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                            <YAxis fontSize={11} axisLine={false} tickLine={false} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              cursor={{ fill: '#f1f5f9' }}
                            />
                            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                          Aucune donnée disponible
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chart 2: Répartition par Zone */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="font-bold text-slate-800">Livraisons par Zone</h4>
                      <Filter className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="h-64 flex items-center">
                      {zoneData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                          <PieChart>
                            <Pie
                              data={zoneData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {zoneData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full text-center text-slate-400 italic text-sm">
                          Aucune zone enregistrée
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Line Chart: Evolution Coûts */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-6">Evolution des Coûts par Semaine</h4>
                  <div className="h-64">
                    {monthlyTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={monthlyTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="week" fontSize={11} axisLine={false} tickLine={false} />
                          <YAxis fontSize={11} axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Line type="monotone" dataKey="cost" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                        Données temporelles insuffisantes
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'list' && (
              <motion.div 
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Advanced Filters Bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Type de Date</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400" />
                        <select 
                          className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer w-full"
                          value={dateTypeFilter}
                          onChange={(e) => setDateTypeFilter(e.target.value as 'depotage' | 'sortie')}
                        >
                          <option value="depotage">Date Dépotage</option>
                          <option value="sortie">Date de Sortie</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Transporteur</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-slate-400" />
                        <select 
                          className="bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer w-full"
                          value={carrierFilter}
                          onChange={(e) => setCarrierFilter(e.target.value)}
                        >
                          <option value="all">Tous les transporteurs</option>
                          {sortedCarriers.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Début Période</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input 
                          type="date" 
                          className="bg-transparent border-none text-xs font-bold focus:ring-0 w-full"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Fin Période</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input 
                          type="date" 
                          className="bg-transparent border-none text-xs font-bold focus:ring-0 w-full"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end pt-2 border-t border-slate-50">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">N° de Voyage</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Ex: 360251..."
                          className="bg-transparent border-none text-xs font-bold focus:ring-0 w-full"
                          value={voyageFilter}
                          onChange={(e) => setVoyageFilter(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">N° de Position</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Ex: 2416..."
                          className="bg-transparent border-none text-xs font-bold focus:ring-0 w-full"
                          value={positionFilter}
                          onChange={(e) => setPositionFilter(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="lg:col-span-2 flex gap-2">
                      <button 
                        onClick={() => {
                          setCarrierFilter('all');
                          setStartDate('');
                          setEndDate('');
                          setSearchTerm('');
                          setMonthFilter('all');
                          setVoyageFilter('');
                          setPositionFilter('');
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Réinitialiser
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h4 className="font-bold text-slate-800">Historique des Livraisons</h4>
                  <span className="text-xs text-slate-500">{filteredData.length} résultats trouvés</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-4 text-xs font-serif italic text-slate-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                        <th className="p-4 text-xs font-serif italic text-slate-400 uppercase tracking-widest whitespace-nowrap">Réf/Voyage</th>
                        <th className="p-4 text-xs font-serif italic text-slate-400 uppercase tracking-widest whitespace-nowrap">Expéditeur</th>
                        <th className="p-4 text-xs font-serif italic text-slate-400 uppercase tracking-widest whitespace-nowrap">Destinataire</th>
                        <th className="p-4 text-xs font-serif italic text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Poids</th>
                        <th className="p-4 text-xs font-serif italic text-slate-400 uppercase tracking-widest whitespace-nowrap">Zone</th>
                        <th className="p-4 text-xs font-serif italic text-slate-400 uppercase tracking-widest whitespace-nowrap">Transporteur</th>
                        <th className="p-4 text-xs font-serif italic text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredData.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                          <td className="p-4 text-xs font-medium text-slate-600 whitespace-nowrap">{item.dateDepotage}</td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">{item.voyage}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Pos: {item.position}</span>
                            </div>
                          </td>
                          <td className="p-4 text-xs text-slate-600 font-medium whitespace-nowrap">{item.expediteur}</td>
                          <td className="p-4 text-xs text-slate-900 font-bold max-w-[200px] truncate">{item.destinataire}</td>
                          <td className="p-4 text-xs font-mono text-right font-medium text-indigo-600 whitespace-nowrap">{item.poids.toLocaleString()} kg</td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                              <MapPin className="w-3 h-3" />
                              {item.zone}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-slate-600 font-medium whitespace-nowrap">{item.transporteur}</td>
                          <td className="p-4">
                            <span className={cn(
                              "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                              item.status === 'Livré' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div 
                key="analytics"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Carrier Selection Header */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Analyses par Transporteur</h3>
                      <p className="text-slate-500 text-sm">Sélectionnez un transporteur pour voir les performances détaillées par date.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-indigo-500" />
                        <select 
                          className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer min-w-[200px]"
                          value={selectedCarrier || ''}
                          onChange={(e) => setSelectedCarrier(e.target.value || null)}
                        >
                          <option value="">Sélectionner un transporteur</option>
                          {sortedCarriers.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      {selectedCarrier && (
                        <button 
                          onClick={() => setSelectedCarrier(null)}
                          className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {selectedCarrier && carrierStats ? (
                  <div className="space-y-8">
                    {/* Carrier Specific KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
                        <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Total Opérations</p>
                        <h4 className="text-3xl font-bold">{carrierStats.totalOps}</h4>
                        <p className="text-indigo-200 text-[10px] mt-2 font-medium italic">Voyages réalisés par {selectedCarrier}</p>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Poids Géré</p>
                        <h4 className="text-3xl font-bold text-slate-900">{carrierStats.totalWeight.toLocaleString()} <span className="text-sm font-medium text-slate-400">kg</span></h4>
                        <p className="text-slate-500 text-[10px] mt-2">Moyenne: {(carrierStats.totalWeight/carrierStats.totalOps).toFixed(0)} kg / voyage</p>
                      </div>
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Coût Logistique</p>
                        <h4 className="text-3xl font-bold text-slate-900">{carrierStats.totalCost.toLocaleString()} <span className="text-sm font-medium text-slate-400">MAD</span></h4>
                        <p className="text-slate-500 text-[10px] mt-2">Coût moyen: {(carrierStats.totalCost/carrierStats.totalOps).toFixed(2)} MAD / voyage</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Timeline Chart */}
                      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="font-bold text-slate-800">Activité par Date</h4>
                          <div className="flex items-center gap-4 text-[10px] font-bold uppercase text-slate-400">
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500"/> Poids</span>
                            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-300"/> Voyages</span>
                          </div>
                        </div>
                        <div className="h-80">
                          {carrierStats.timeline.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                              <BarChart data={carrierStats.timeline}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" fontSize={11} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left" fontSize={11} axisLine={false} tickLine={false} stroke="#6366f1" />
                                <YAxis yAxisId="right" orientation="right" fontSize={11} axisLine={false} tickLine={false} stroke="#94a3b8" />
                                <Tooltip 
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar yAxisId="left" dataKey="weight" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={25} />
                                <Bar yAxisId="right" dataKey="ops" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={25} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                              Aucune donnée chronologique disponible
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Daily Operations List */}
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-800 mb-6">Résumé Quotidien</h4>
                        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                          {carrierStats.timeline.map((day, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <div>
                                <p className="text-xs font-bold text-slate-900">{day.date}</p>
                                <p className="text-[10px] text-slate-500">{day.ops} opération(s)</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-mono font-bold text-indigo-600">{day.weight.toLocaleString()} kg</p>
                                <p className="text-[10px] font-medium text-slate-400">{day.cost.toLocaleString()} MAD</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
                        <TrendingUp className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">Sélectionner un Transporteur</h3>
                      <p className="text-slate-500 text-sm max-w-sm">
                        Choisissez un prestataire dans la liste ci-dessus pour accéder aux statistiques temporelles et analytiques détaillées.
                      </p>
                    </div>
                    
                    <div className="space-y-6">
                      {transportData.map((t, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => setSelectedCarrier(t.name)}
                          className="w-full bg-white px-6 py-4 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm hover:border-indigo-500 transition-all text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                              {t.name.substring(0, 2)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{t.name}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Voir les détails</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-mono font-bold text-slate-900">{t.value.toLocaleString()} kg</p>
                            <div className="w-32 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                              <div 
                                className="h-full bg-indigo-500" 
                                style={{ width: `${(t.value / kpis.totalWeight) * 100}%` }}
                              />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'tours' && (
              <motion.div 
                key="tours"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6 pb-20"
              >
                {/* Compact Filter Bar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
                      <Navigation className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-700">{filteredData.length} Tournées</span>
                    </div>
                    
                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                    
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <select 
                        className="bg-white border border-slate-200 text-xs font-medium px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                        value={deliveryTypeFilter}
                        onChange={(e) => setDeliveryTypeFilter(e.target.value)}
                      >
                        <option value="all">Tous les Flux</option>
                        {Array.from(new Set(data.map(i => i.typeLivraison).filter(Boolean))).sort().map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>

                      <select 
                        className="bg-white border border-slate-200 text-xs font-medium px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                        value={carrierFilter}
                        onChange={(e) => setCarrierFilter(e.target.value)}
                      >
                        <option value="all">Tous Transporteurs</option>
                        {sortedCarriers.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>

                      <select 
                        className="bg-white border border-slate-200 text-xs font-medium px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                        value={dateTypeFilter}
                        onChange={(e) => setDateTypeFilter(e.target.value as 'depotage' | 'sortie')}
                      >
                        <option value="depotage">Date Dépotage</option>
                        <option value="sortie">Date Sortie</option>
                      </select>

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input 
                          type="date" 
                          className="bg-white border border-slate-200 text-xs font-medium px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          placeholder="Date début"
                        />
                      </div>

                      <span className="text-slate-400 text-xs">→</span>

                      <input 
                        type="date" 
                        className="bg-white border border-slate-200 text-xs font-medium px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        placeholder="Date fin"
                      />
                    </div>

                      <button 
                        onClick={() => {
                          setDeliveryTypeFilter('all');
                          setStartDate('');
                          setEndDate('');
                          setCarrierFilter('all');
                          setSearchTerm('');
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Réinitialiser
                      </button>

                      <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                      >
                        <Download className="w-4 h-4" />
                        CSV
                      </button>

                      <button 
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                      >
                        <FileText className="w-4 h-4" />
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  {(() => {
                    return Object.entries(groupedTours).sort((a,b) => a[0].localeCompare(b[0])).map(([type, carriers]) => (
                    <div key={type} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider",
                          type.toLowerCase().includes('mensuel') ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : 
                          type.toLowerCase().includes('affrete') ? "bg-amber-100 text-amber-700 border border-amber-200" :
                          type.toLowerCase().includes('international') ? "bg-indigo-100 text-indigo-700 border border-indigo-200" :
                          "bg-slate-900 text-white"
                        )}>
                          {type}
                        </div>
                        <div className="h-px bg-slate-200 flex-1" />
                      </div>

                      {Object.entries(carriers).sort((a,b) => a[0].localeCompare(b[0])).map(([carrierName, dates]) => (
                        <div key={carrierName} className="space-y-4">
                          <div className="flex items-center gap-3 bg-slate-100/50 px-4 py-2 rounded-xl">
                            <Truck className="w-4 h-4 text-slate-600" />
                            <h4 className="text-sm font-bold text-slate-700">{carrierName}</h4>
                            <div className="h-px bg-slate-300 flex-1" />
                            <span className="text-xs text-slate-400 font-medium">
                              {Object.values(dates).reduce((sum, d) => sum + Object.keys(d).length, 0)} tournée(s)
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {Object.entries(dates).sort((a,b) => parseDate(b[0])! - parseDate(a[0])!).flatMap(([date, tours]) =>
                              Object.entries(tours).sort((a,b) => Number(a[0]) - Number(b[0])).map(([tourNo, items]) => {
                                const tourTotalCost = items.reduce((sum, i) => sum + i.prixHT, 0);
                                const tourTotalWeight = items.reduce((sum, i) => sum + i.poids, 0);
                                const tourTotalColis = items.reduce((sum, i) => sum + i.nbreColis, 0);
                                const vhc = items[0]?.nVehicule || "—";
                                const zones = Array.from(new Set(items.map(i => i.zone))).filter(Boolean).sort();
                                
                                return (
                                  <div key={`${date}-${tourNo}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all duration-200">
                                    <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-white/20 text-xs font-bold px-2 py-0.5 rounded-lg">#{tourNo}</span>
                                            <span className="text-xs text-slate-300">{date}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="text-sm font-semibold">{vhc}</span>
                                          </div>
                                          {zones.length > 0 && (
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                              <MapPin className="w-3 h-3 text-slate-400" />
                                              <span className="text-xs text-slate-300">{zones.join(', ')}</span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <p className="text-lg font-bold">{tourTotalCost.toLocaleString()}</p>
                                          <p className="text-[10px] text-slate-400 uppercase">MAD</p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                                      {items.map((item, idx) => (
                                        <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                          <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-bold text-slate-800 truncate">{item.expediteur}</p>
                                              <p className="text-[10px] text-slate-500 truncate">{item.destinataire}</p>
                                            </div>
                                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                              {item.poids.toLocaleString()} kg
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    
                                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                      <div className="flex items-center gap-4 text-[10px]">
                                        <span className="text-slate-500">Colis: <strong className="text-slate-700">{tourTotalColis}</strong></span>
                                        <span className="text-slate-500">Total: <strong className="text-slate-700">{tourTotalWeight.toLocaleString()} kg</strong></span>
                                      </div>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const bcdNumber = getBcdNumberForTour(tourNo, date, carrierName);
                                          generateBCD(tourNo, items, bcdNumber, operationType === 'export');
                                        }}
                                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        BCD
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}

                {filteredData.length === 0 && (
                  <div className="bg-white p-20 rounded-[40px] border border-slate-200 shadow-2xl text-center flex flex-col items-center max-w-2xl mx-auto mt-20">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                      <Navigation className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">Aucune tournée détectée</h3>
                    <p className="text-slate-500 font-medium max-w-sm">Désolé, mais vos filtres actuels ne correspondent à aucune donnée. Essayez d'ajuster les dates ou de sélectionner "Tous les Flux".</p>
                    <button 
                      onClick={() => {
                        setDeliveryTypeFilter('all');
                        setStartDate('');
                        setEndDate('');
                        setCarrierFilter('all');
                      }}
                      className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- Sub-components ---

function NavItem({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
        active 
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      )}
    >
      <Icon className={cn("w-5 h-5", active ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
      <span className="text-sm font-medium">{label}</span>
      {active && <ChevronRight className="w-4 h-4 ml-auto" />}
    </button>
  );
}
