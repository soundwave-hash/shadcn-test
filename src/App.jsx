import { useState, useRef, useEffect } from 'react'
import './App.css'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sun, Download } from 'lucide-react'
import KpiDetailPage from './KpiDetailPage'
import GeoScreen from './GeoScreen'
import InventoryScreen from './InventoryScreen'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// ── Theme tokens ───────────────────────────────────────────────────────────────
const THEME = {
  dark: {
    bg: '#111', navBg: '#161616', panelBg: '#1c1c1c',
    border: '#2a2a2a', borderLight: '#1a1a1a',
    text: '#fff', textMuted: '#aaa', textDim: '#555', textFaint: '#444',
    inputBg: '#252525', inputBorder: '#3a3a3a', inputText: '#ddd',
    dropdownBg: '#1e1e1e', dropdownBorder: '#333',
    rowHover: '#1e2a2a', chartMask: '#1c1c1c', chartGrid: '#1e1e1e',
    cardBg: '#181818', cardBorder: '#222',
    axTick: '#666', tooltipBg: '#1a1a1a', tooltipBorder: '#3a3a3a',
    activeItemBg: '#1a2a2a', sep: '#555',
  },
  light: {
    bg: '#dcdfe3', navBg: '#f9fafb', panelBg: '#f9fafb',
    border: '#dde1e7', borderLight: '#e4e7eb',
    text: '#111', textMuted: '#555', textDim: '#888', textFaint: '#aaa',
    inputBg: '#eef0f3', inputBorder: '#dde1e7', inputText: '#333',
    dropdownBg: '#f9fafb', dropdownBorder: '#dde1e7',
    rowHover: '#e0eff5', chartMask: '#f4f5f7', chartGrid: '#e4e7eb',
    cardBg: '#f9fafb', cardBorder: '#dde1e7',
    axTick: '#888', tooltipBg: '#f9fafb', tooltipBorder: '#dde1e7',
    activeItemBg: '#d8eef4', sep: '#bbb',
  },
}

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  express:   '#00bcd4',
  ground:    '#f44336',
  priority:  '#4caf50',
  sameDay:   '#ff9800',
  standard:  '#3f51b5',
  freight:   '#e91e63',
  returns:   '#8bc34a',
  unknown:   '#9e9e9e',
  delivered: '#4caf50',
  failed:    '#f44336',
  canceled:  '#757575',
}

// ── Per-country mock data ─────────────────────────────────────────────────────
const COUNTRY_DATA = {
  'United States': {
    kpi1: [
      { label:'Shipment Time (hrs) - P95',   sublabel:'',           primary:'8.64',   secondary:'21.54' },
      { label:'Unit Sales (Daily Avg)', sublabel:'Daily Avg',      primary:'12.93K', secondary:'1.68K', secondaryLabel:'Std Dev' },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'17.41K', secondary:''      },
      { label:'Order Count (All Carriers)',   sublabel:'Carrier Count', primary:'95.76K', secondary:'756'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'604.8K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'',           primary:'0.03',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'14.85', secondary:'0'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'30',    secondary:'4'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.17',  secondary:'0.32' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.03',  secondary:'0.16' },
      { label:'Pallets Loaded - Avg',     sublabel:'', primary:'0.27',  secondary:'0.29' },
      { label:'Returns Processed - Avg',  sublabel:'', primary:'0.02',  secondary:'0'    },
    ],
    carriers: [
      { carrier:'FedEx Express',    express:38541, ground:2500,  priority:1000, sameDay:500,  standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'UPS Ground',       express:1000,  ground:28535, priority:1000, sameDay:0,    standard:500, freight:0, returns:500, unknown:0     },
      { carrier:'USPS Priority',    express:300,   ground:500,   priority:0,    sameDay:7200, standard:200, freight:0, returns:0,   unknown:0     },
      { carrier:'DHL',              express:4800,  ground:0,     priority:200,  sameDay:100,  standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'Amazon Logistics', express:200,   ground:3800,  priority:0,    sameDay:200,  standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'OnTrac',           express:100,   ground:2900,  priority:100,  sameDay:0,    standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'LaserShip',        express:0,     ground:2600,  priority:100,  sameDay:0,    standard:100, freight:0, returns:0,   unknown:0     },
      { carrier:'GSO',              express:100,   ground:1700,  priority:0,    sameDay:0,    standard:100, freight:0, returns:0,   unknown:0     },
      { carrier:'Spee-Dee',         express:0,     ground:1100,  priority:0,    sameDay:0,    standard:100, freight:0, returns:0,   unknown:0     },
      { carrier:'Courier Express',  express:0,     ground:800,   priority:0,    sameDay:0,    standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'CDL Last Mile',    express:0,     ground:650,   priority:0,    sameDay:0,    standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'Unknown',          express:0,     ground:0,     priority:0,    sameDay:0,    standard:0,   freight:0, returns:0,   unknown:11852 },
    ],
    time: [
      { date:'Nov 14', express:10437, ground:3114, priority:4692, sameDay:691,  standard:0    },
      { date:'Nov 15', express:5984,  ground:2137, priority:4568, sameDay:0,    standard:0    },
      { date:'Nov 16', express:776,   ground:4440, priority:0,    sameDay:0,    standard:0    },
      { date:'Nov 17', express:2558,  ground:4451, priority:0,    sameDay:697,  standard:0    },
      { date:'Nov 18', express:9922,  ground:4435, priority:0,    sameDay:1622, standard:0    },
      { date:'Nov 19', express:7133,  ground:4475, priority:0,    sameDay:2806, standard:1288 },
      { date:'Nov 20', express:5731,  ground:4474, priority:0,    sameDay:3214, standard:943  },
    ],
    failure:  [{ name:'rate', delivered:88260, failed:7800, canceled:2100 }],
    status: [
      { date:'Nov 14', delivered:88, failed:8,  canceled:4  },
      { date:'Nov 15', delivered:85, failed:10, canceled:5  },
      { date:'Nov 16', delivered:45, failed:35, canceled:20 },
      { date:'Nov 17', delivered:48, failed:33, canceled:19 },
      { date:'Nov 18', delivered:87, failed:9,  canceled:4  },
      { date:'Nov 19', delivered:84, failed:11, canceled:5  },
      { date:'Nov 20', delivered:83, failed:12, canceled:5  },
    ],
  },

  'Canada': {
    kpi1: [
      { label:'Shipment Time (hrs) - P95',   sublabel:'',           primary:'6.21',   secondary:'14.80' },
      { label:'Unit Sales (Daily Avg)', sublabel:'Daily Avg',      primary:'2.59K',  secondary:'334',  secondaryLabel:'Std Dev' },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'11.20K', secondary:''      },
      { label:'Order Count (All Carriers)',   sublabel:'Carrier Count', primary:'42.30K', secondary:'312'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'298.4K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'',           primary:'0.02',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'9.40',  secondary:'0'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'18',    secondary:'2'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.12',  secondary:'0.24' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.05',  secondary:'0.22' },
      { label:'Pallets Loaded - Avg',     sublabel:'', primary:'0.19',  secondary:'0.21' },
      { label:'Returns Processed - Avg',  sublabel:'', primary:'0.03',  secondary:'0'    },
    ],
    carriers: [
      { carrier:'Purolator',       express:14200, ground:3100, priority:800,  sameDay:400,  standard:0,   freight:0, returns:0,   unknown:0    },
      { carrier:'Canada Post',     express:2100,  ground:9800, priority:1200, sameDay:0,    standard:600, freight:0, returns:300, unknown:0    },
      { carrier:'DHL Canada',      express:3200,  ground:0,    priority:400,  sameDay:200,  standard:0,   freight:0, returns:0,   unknown:0    },
      { carrier:'FedEx Canada',    express:8400,  ground:1200, priority:500,  sameDay:300,  standard:0,   freight:0, returns:0,   unknown:0    },
      { carrier:'UPS Canada',      express:600,   ground:7200, priority:400,  sameDay:0,    standard:200, freight:0, returns:100, unknown:0    },
      { carrier:'Canpar',          express:0,     ground:2100, priority:0,    sameDay:0,    standard:100, freight:0, returns:0,   unknown:0    },
      { carrier:'Loomis Express',  express:100,   ground:1400, priority:100,  sameDay:0,    standard:0,   freight:0, returns:0,   unknown:0    },
      { carrier:'Unknown',         express:0,     ground:0,    priority:0,    sameDay:0,    standard:0,   freight:0, returns:0,   unknown:3200 },
    ],
    time: [
      { date:'Nov 14', express:4200, ground:1800, priority:1100, sameDay:300, standard:0   },
      { date:'Nov 15', express:3100, ground:2200, priority:900,  sameDay:0,   standard:0   },
      { date:'Nov 16', express:1800, ground:2400, priority:0,    sameDay:0,   standard:0   },
      { date:'Nov 17', express:2200, ground:2100, priority:0,    sameDay:400, standard:0   },
      { date:'Nov 18', express:3900, ground:1900, priority:0,    sameDay:600, standard:0   },
      { date:'Nov 19', express:3400, ground:2000, priority:0,    sameDay:900, standard:400 },
      { date:'Nov 20', express:2800, ground:1800, priority:0,    sameDay:700, standard:300 },
    ],
    failure:  [{ name:'rate', delivered:39100, failed:2400, canceled:800 }],
    status: [
      { date:'Nov 14', delivered:91, failed:6,  canceled:3  },
      { date:'Nov 15', delivered:89, failed:8,  canceled:3  },
      { date:'Nov 16', delivered:72, failed:20, canceled:8  },
      { date:'Nov 17', delivered:74, failed:18, canceled:8  },
      { date:'Nov 18', delivered:90, failed:7,  canceled:3  },
      { date:'Nov 19', delivered:88, failed:9,  canceled:3  },
      { date:'Nov 20', delivered:87, failed:10, canceled:3  },
    ],
  },

  'Mexico': {
    kpi1: [
      { label:'Shipment Time (hrs) - P95',   sublabel:'',           primary:'11.40',  secondary:'28.60' },
      { label:'Unit Sales (Daily Avg)', sublabel:'Daily Avg',      primary:'1.29K',  secondary:'208',  secondaryLabel:'Std Dev' },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'22.80K', secondary:''      },
      { label:'Order Count (All Carriers)',   sublabel:'Carrier Count', primary:'31.50K', secondary:'218'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'412.1K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'',           primary:'0.07',   secondary:'0.01'  },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'18.20', secondary:'2'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'22',    secondary:'5'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.31',  secondary:'0.58' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.09',  secondary:'0.28' },
      { label:'Pallets Loaded - Avg',     sublabel:'', primary:'0.41',  secondary:'0.44' },
      { label:'Returns Processed - Avg',  sublabel:'', primary:'0.06',  secondary:'0.01' },
    ],
    carriers: [
      { carrier:'Estafeta',        express:9800,  ground:2100, priority:600,  sameDay:300,  standard:0,   freight:100, returns:0,   unknown:0    },
      { carrier:'DHL Mexico',      express:4200,  ground:0,    priority:300,  sameDay:200,  standard:0,   freight:0,   returns:0,   unknown:0    },
      { carrier:'FedEx Mexico',    express:3800,  ground:800,  priority:400,  sameDay:100,  standard:0,   freight:0,   returns:0,   unknown:0    },
      { carrier:'Redpack',         express:0,     ground:3200, priority:0,    sameDay:0,    standard:200, freight:0,   returns:100, unknown:0    },
      { carrier:'Paquetexpress',   express:200,   ground:2400, priority:100,  sameDay:0,    standard:100, freight:0,   returns:0,   unknown:0    },
      { carrier:'UPS Mexico',      express:400,   ground:1800, priority:200,  sameDay:0,    standard:100, freight:0,   returns:0,   unknown:0    },
      { carrier:'Correos Mexico',  express:0,     ground:1400, priority:0,    sameDay:0,    standard:200, freight:0,   returns:200, unknown:0    },
      { carrier:'Unknown',         express:0,     ground:0,    priority:0,    sameDay:0,    standard:0,   freight:0,   returns:0,   unknown:4800 },
    ],
    time: [
      { date:'Nov 14', express:3800, ground:2100, priority:800,  sameDay:400, standard:0   },
      { date:'Nov 15', express:2600, ground:1900, priority:600,  sameDay:0,   standard:0   },
      { date:'Nov 16', express:900,  ground:2200, priority:0,    sameDay:0,   standard:200 },
      { date:'Nov 17', express:1400, ground:2000, priority:0,    sameDay:500, standard:0   },
      { date:'Nov 18', express:3200, ground:1800, priority:0,    sameDay:700, standard:0   },
      { date:'Nov 19', express:2800, ground:1900, priority:0,    sameDay:900, standard:500 },
      { date:'Nov 20', express:2200, ground:1700, priority:0,    sameDay:800, standard:400 },
    ],
    failure:  [{ name:'rate', delivered:26400, failed:3800, canceled:1300 }],
    status: [
      { date:'Nov 14', delivered:80, failed:14, canceled:6  },
      { date:'Nov 15', delivered:77, failed:16, canceled:7  },
      { date:'Nov 16', delivered:55, failed:30, canceled:15 },
      { date:'Nov 17', delivered:58, failed:28, canceled:14 },
      { date:'Nov 18', delivered:79, failed:15, canceled:6  },
      { date:'Nov 19', delivered:76, failed:17, canceled:7  },
      { date:'Nov 20', delivered:75, failed:18, canceled:7  },
    ],
  },

  'Germany': {
    kpi1: [
      { label:'Shipment Time (hrs) - P95',   sublabel:'',           primary:'5.80',   secondary:'12.40' },
      { label:'Unit Sales (Daily Avg)', sublabel:'Daily Avg',      primary:'1.29K',  secondary:'191',  secondaryLabel:'Std Dev' },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'9.60K',  secondary:''      },
      { label:'Order Count (All Carriers)',   sublabel:'Carrier Count', primary:'68.20K', secondary:'480'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'521.3K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'',           primary:'0.01',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'11.20', secondary:'1'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'26',    secondary:'3'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.09',  secondary:'0.18' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.02',  secondary:'0.10' },
      { label:'Pallets Loaded - Avg',     sublabel:'', primary:'0.33',  secondary:'0.35' },
      { label:'Returns Processed - Avg',  sublabel:'', primary:'0.04',  secondary:'0'    },
    ],
    carriers: [
      { carrier:'DHL Germany',     express:22000, ground:4200, priority:1800, sameDay:900,  standard:0,   freight:200, returns:0,   unknown:0    },
      { carrier:'DPD',             express:1200,  ground:14800,priority:600,  sameDay:0,    standard:400, freight:0,   returns:300, unknown:0    },
      { carrier:'Hermes',          express:400,   ground:8200, priority:0,    sameDay:0,    standard:200, freight:0,   returns:400, unknown:0    },
      { carrier:'GLS',             express:200,   ground:5400, priority:200,  sameDay:0,    standard:100, freight:0,   returns:100, unknown:0    },
      { carrier:'UPS Germany',     express:800,   ground:3200, priority:300,  sameDay:0,    standard:100, freight:0,   returns:0,   unknown:0    },
      { carrier:'FedEx Germany',   express:2100,  ground:600,  priority:200,  sameDay:100,  standard:0,   freight:0,   returns:0,   unknown:0    },
      { carrier:'TNT',             express:600,   ground:1800, priority:100,  sameDay:0,    standard:100, freight:0,   returns:0,   unknown:0    },
      { carrier:'Unknown',         express:0,     ground:0,    priority:0,    sameDay:0,    standard:0,   freight:0,   returns:0,   unknown:2800 },
    ],
    time: [
      { date:'Nov 14', express:8200, ground:4100, priority:2200, sameDay:800, standard:0   },
      { date:'Nov 15', express:6800, ground:3900, priority:1800, sameDay:0,   standard:0   },
      { date:'Nov 16', express:4200, ground:4800, priority:0,    sameDay:0,   standard:0   },
      { date:'Nov 17', express:5100, ground:4400, priority:0,    sameDay:900, standard:0   },
      { date:'Nov 18', express:9400, ground:4200, priority:0,    sameDay:1400,standard:0   },
      { date:'Nov 19', express:7800, ground:4600, priority:0,    sameDay:2100,standard:1100},
      { date:'Nov 20', express:6200, ground:4300, priority:0,    sameDay:1900,standard:800 },
    ],
    failure:  [{ name:'rate', delivered:64800, failed:2400, canceled:1000 }],
    status: [
      { date:'Nov 14', delivered:94, failed:4,  canceled:2  },
      { date:'Nov 15', delivered:93, failed:5,  canceled:2  },
      { date:'Nov 16', delivered:82, failed:13, canceled:5  },
      { date:'Nov 17', delivered:84, failed:11, canceled:5  },
      { date:'Nov 18', delivered:93, failed:5,  canceled:2  },
      { date:'Nov 19', delivered:92, failed:6,  canceled:2  },
      { date:'Nov 20', delivered:91, failed:7,  canceled:2  },
    ],
  },

  'Japan': {
    kpi1: [
      { label:'Shipment Time (hrs) - P95',   sublabel:'',           primary:'4.20',   secondary:'9.10'  },
      { label:'Unit Sales (Daily Avg)', sublabel:'Daily Avg',      primary:'647',    secondary:'79',   secondaryLabel:'Std Dev' },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'7.30K',  secondary:''      },
      { label:'Order Count (All Carriers)',   sublabel:'Carrier Count', primary:'112.4K', secondary:'620'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'680.2K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'',           primary:'0.01',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'8.60',  secondary:'0'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'42',    secondary:'6'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.07',  secondary:'0.14' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.01',  secondary:'0.06' },
      { label:'Pallets Loaded - Avg',     sublabel:'', primary:'0.48',  secondary:'0.51' },
      { label:'Returns Processed - Avg',  sublabel:'', primary:'0.01',  secondary:'0'    },
    ],
    carriers: [
      { carrier:'Yamato Transport', express:32000, ground:5200, priority:2400, sameDay:1800, standard:0,   freight:400, returns:0,   unknown:0    },
      { carrier:'Sagawa Express',   express:4200,  ground:18000,priority:1200, sameDay:0,    standard:600, freight:0,   returns:400, unknown:0    },
      { carrier:'Japan Post',       express:1800,  ground:9400, priority:800,  sameDay:0,    standard:400, freight:0,   returns:200, unknown:0    },
      { carrier:'Seino Transport',  express:600,   ground:4800, priority:0,    sameDay:0,    standard:200, freight:200, returns:0,   unknown:0    },
      { carrier:'Fukuyama Transco', express:200,   ground:3200, priority:100,  sameDay:0,    standard:100, freight:100, returns:0,   unknown:0    },
      { carrier:'DHL Japan',        express:2800,  ground:400,  priority:300,  sameDay:200,  standard:0,   freight:0,   returns:0,   unknown:0    },
      { carrier:'FedEx Japan',      express:1900,  ground:300,  priority:200,  sameDay:100,  standard:0,   freight:0,   returns:0,   unknown:0    },
      { carrier:'Unknown',          express:0,     ground:0,    priority:0,    sameDay:0,    standard:0,   freight:0,   returns:0,   unknown:2800 },
    ],
    time: [
      { date:'Nov 14', express:12400, ground:5200, priority:3800, sameDay:1200, standard:0    },
      { date:'Nov 15', express:9800,  ground:4800, priority:3200, sameDay:0,    standard:0    },
      { date:'Nov 16', express:6200,  ground:5600, priority:0,    sameDay:0,    standard:0    },
      { date:'Nov 17', express:7800,  ground:5200, priority:0,    sameDay:1400, standard:0    },
      { date:'Nov 18', express:11200, ground:4900, priority:0,    sameDay:2100, standard:0    },
      { date:'Nov 19', express:9400,  ground:5100, priority:0,    sameDay:3200, standard:1600 },
      { date:'Nov 20', express:8200,  ground:4800, priority:0,    sameDay:2800, standard:1200 },
    ],
    failure:  [{ name:'rate', delivered:107200, failed:3800, canceled:1400 }],
    status: [
      { date:'Nov 14', delivered:96, failed:3,  canceled:1  },
      { date:'Nov 15', delivered:95, failed:4,  canceled:1  },
      { date:'Nov 16', delivered:88, failed:9,  canceled:3  },
      { date:'Nov 17', delivered:89, failed:8,  canceled:3  },
      { date:'Nov 18', delivered:95, failed:4,  canceled:1  },
      { date:'Nov 19', delivered:94, failed:5,  canceled:1  },
      { date:'Nov 20', delivered:94, failed:5,  canceled:1  },
    ],
  },

  'South Korea': {
    kpi1: [
      { label:'Shipment Time (hrs) - P95',   sublabel:'',           primary:'3.90',   secondary:'8.40'  },
      { label:'Unit Sales (Daily Avg)', sublabel:'Daily Avg',      primary:'259',    secondary:'31',   secondaryLabel:'Std Dev' },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'6.80K',  secondary:''      },
      { label:'Order Count (All Carriers)',   sublabel:'Carrier Count', primary:'88.60K', secondary:'510'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'544.9K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'',           primary:'0.01',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'7.80',  secondary:'0'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'38',    secondary:'5'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.06',  secondary:'0.12' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.01',  secondary:'0.05' },
      { label:'Pallets Loaded - Avg',     sublabel:'', primary:'0.44',  secondary:'0.46' },
      { label:'Returns Processed - Avg',  sublabel:'', primary:'0.02',  secondary:'0'    },
    ],
    carriers: [
      { carrier:'CJ Logistics',    express:28000, ground:4800, priority:2200, sameDay:2400, standard:0,   freight:300, returns:0,   unknown:0    },
      { carrier:'Lotte Global',    express:3200,  ground:14200,priority:800,  sameDay:0,    standard:400, freight:0,   returns:300, unknown:0    },
      { carrier:'Korea Post',      express:1200,  ground:7800, priority:600,  sameDay:0,    standard:300, freight:0,   returns:100, unknown:0    },
      { carrier:'Hanjin',          express:400,   ground:4200, priority:0,    sameDay:0,    standard:100, freight:200, returns:0,   unknown:0    },
      { carrier:'Hyundai Glovis',  express:200,   ground:2800, priority:100,  sameDay:0,    standard:100, freight:300, returns:0,   unknown:0    },
      { carrier:'DHL Korea',       express:2400,  ground:300,  priority:200,  sameDay:200,  standard:0,   freight:0,   returns:0,   unknown:0    },
      { carrier:'FedEx Korea',     express:1600,  ground:200,  priority:100,  sameDay:100,  standard:0,   freight:0,   returns:0,   unknown:0    },
      { carrier:'Unknown',         express:0,     ground:0,    priority:0,    sameDay:0,    standard:0,   freight:0,   returns:0,   unknown:2200 },
    ],
    time: [
      { date:'Nov 14', express:10200, ground:4600, priority:3400, sameDay:2100, standard:0    },
      { date:'Nov 15', express:8400,  ground:4200, priority:2800, sameDay:0,    standard:0    },
      { date:'Nov 16', express:5400,  ground:4900, priority:0,    sameDay:0,    standard:0    },
      { date:'Nov 17', express:6800,  ground:4500, priority:0,    sameDay:2400, standard:0    },
      { date:'Nov 18', express:9800,  ground:4300, priority:0,    sameDay:3200, standard:0    },
      { date:'Nov 19', express:8200,  ground:4600, priority:0,    sameDay:3800, standard:1400 },
      { date:'Nov 20', express:7200,  ground:4200, priority:0,    sameDay:3100, standard:1000 },
    ],
    failure:  [{ name:'rate', delivered:84200, failed:2800, canceled:1600 }],
    status: [
      { date:'Nov 14', delivered:95, failed:4,  canceled:1  },
      { date:'Nov 15', delivered:94, failed:5,  canceled:1  },
      { date:'Nov 16', delivered:86, failed:10, canceled:4  },
      { date:'Nov 17', delivered:87, failed:9,  canceled:4  },
      { date:'Nov 18', delivered:94, failed:5,  canceled:1  },
      { date:'Nov 19', delivered:93, failed:6,  canceled:1  },
      { date:'Nov 20', delivered:93, failed:6,  canceled:1  },
    ],
  },

  'China': {
    kpi1: [
      { label:'Shipment Time (hrs) - P95',   sublabel:'',           primary:'5.10',   secondary:'13.80' },
      { label:'Unit Sales (Daily Avg)', sublabel:'Daily Avg',      primary:'45.26K', secondary:'6.41K', secondaryLabel:'Std Dev' },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'24.60K', secondary:''      },
      { label:'Order Count (All Carriers)',   sublabel:'Carrier Count', primary:'284.3K', secondary:'1,240' },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'1.82M',  secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'',           primary:'0.04',   secondary:'0.01'  },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'22.40', secondary:'3'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'86',    secondary:'12'   },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.14',  secondary:'0.29' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.02',  secondary:'0.11' },
      { label:'Pallets Loaded - Avg',     sublabel:'', primary:'0.62',  secondary:'0.66' },
      { label:'Returns Processed - Avg',  sublabel:'', primary:'0.05',  secondary:'0.01' },
    ],
    carriers: [
      { carrier:'SF Express',      express:88000, ground:12000,priority:6400, sameDay:8200, standard:0,    freight:800, returns:0,    unknown:0     },
      { carrier:'ZTO Express',     express:8400,  ground:64000,priority:3200, sameDay:0,    standard:2400, freight:0,   returns:1800, unknown:0     },
      { carrier:'JD Logistics',    express:12000, ground:28000,priority:2400, sameDay:4800, standard:0,    freight:600, returns:0,    unknown:0     },
      { carrier:'YTO Express',     express:2400,  ground:22000,priority:0,    sameDay:0,    standard:1200, freight:0,   returns:800,  unknown:0     },
      { carrier:'STO Express',     express:1600,  ground:18000,priority:0,    sameDay:0,    standard:800,  freight:0,   returns:600,  unknown:0     },
      { carrier:'Cainiao',         express:6400,  ground:14000,priority:1200, sameDay:2400, standard:0,    freight:0,   returns:0,    unknown:0     },
      { carrier:'DHL China',       express:4800,  ground:1200, priority:600,  sameDay:400,  standard:0,    freight:0,   returns:0,    unknown:0     },
      { carrier:'Unknown',         express:0,     ground:0,    priority:0,    sameDay:0,    standard:0,    freight:0,   returns:0,    unknown:14800 },
    ],
    time: [
      { date:'Nov 14', express:32400, ground:14200,priority:8800, sameDay:6200, standard:0    },
      { date:'Nov 15', express:26800, ground:13400,priority:7200, sameDay:0,    standard:0    },
      { date:'Nov 16', express:18200, ground:15800,priority:0,    sameDay:0,    standard:0    },
      { date:'Nov 17', express:22400, ground:14800,priority:0,    sameDay:7400, standard:0    },
      { date:'Nov 18', express:30200, ground:13600,priority:0,    sameDay:9800, standard:0    },
      { date:'Nov 19', express:28400, ground:14400,priority:0,    sameDay:11200,standard:4800 },
      { date:'Nov 20', express:24800, ground:13200,priority:0,    sameDay:9600, standard:3600 },
    ],
    failure:  [{ name:'rate', delivered:264200, failed:14800, canceled:5300 }],
    status: [
      { date:'Nov 14', delivered:90, failed:7,  canceled:3  },
      { date:'Nov 15', delivered:88, failed:9,  canceled:3  },
      { date:'Nov 16', delivered:68, failed:22, canceled:10 },
      { date:'Nov 17', delivered:70, failed:20, canceled:10 },
      { date:'Nov 18', delivered:89, failed:8,  canceled:3  },
      { date:'Nov 19', delivered:87, failed:10, canceled:3  },
      { date:'Nov 20', delivered:86, failed:11, canceled:3  },
    ],
  },
}

const COUNTRIES = Object.keys(COUNTRY_DATA)

// ── City lists & scale factors ────────────────────────────────────────────────
const CITY_LISTS = {
  'United States': ['All', 'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia'],
  'Canada':        ['All', 'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton'],
  'Mexico':        ['All', 'Mexico City', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León'],
  'Germany':       ['All', 'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart'],
  'Japan':         ['All', 'Tokyo', 'Osaka', 'Nagoya', 'Sapporo', 'Fukuoka', 'Kyoto'],
  'South Korea':   ['All', 'Seoul', 'Busan', 'Incheon', 'Daegu', 'Gwangju', 'Daejeon'],
  'China':         ['All', 'Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Wuhan'],
}

const CITY_SCALES = {
  'United States': { 'New York': 0.22, 'Los Angeles': 0.19, 'Chicago': 0.15, 'Houston': 0.17, 'Phoenix': 0.13, 'Philadelphia': 0.14 },
  'Canada':        { 'Toronto': 0.32, 'Vancouver': 0.22, 'Montreal': 0.20, 'Calgary': 0.12, 'Ottawa': 0.08, 'Edmonton': 0.06 },
  'Mexico':        { 'Mexico City': 0.36, 'Guadalajara': 0.20, 'Monterrey': 0.18, 'Puebla': 0.12, 'Tijuana': 0.08, 'León': 0.06 },
  'Germany':       { 'Berlin': 0.22, 'Munich': 0.20, 'Hamburg': 0.18, 'Frankfurt': 0.17, 'Cologne': 0.13, 'Stuttgart': 0.10 },
  'Japan':         { 'Tokyo': 0.38, 'Osaka': 0.24, 'Nagoya': 0.14, 'Sapporo': 0.10, 'Fukuoka': 0.08, 'Kyoto': 0.06 },
  'South Korea':   { 'Seoul': 0.45, 'Busan': 0.20, 'Incheon': 0.15, 'Daegu': 0.10, 'Gwangju': 0.06, 'Daejeon': 0.04 },
  'China':         { 'Beijing': 0.18, 'Shanghai': 0.24, 'Guangzhou': 0.17, 'Shenzhen': 0.16, 'Chengdu': 0.14, 'Wuhan': 0.11 },
}

function parseNum(str) {
  if (!str) return 0
  const s = String(str).replace(/,/g, '').trim()
  if (s.endsWith('M')) return parseFloat(s) * 1e6
  if (s.endsWith('K')) return parseFloat(s) * 1e3
  return parseFloat(s) || 0
}

function fmtNum(n, template) {
  const t = String(template || n).replace(/,/g, '').trim()
  if (t.endsWith('M')) return `${(n / 1e6).toFixed(2)}M`
  if (t.endsWith('K')) return `${(n / 1e3).toFixed(2)}K`
  const dec = t.includes('.') ? t.split('.')[1].length : 0
  return n.toFixed(dec)
}

function scaleStr(str, scale) {
  if (!str || scale === 1) return str
  return fmtNum(parseNum(str) * scale, str)
}

function getMultiCityScale(country, selectedCities) {
  if (!selectedCities || selectedCities.length === 0) return 1
  return selectedCities.reduce((s, city) => s + (CITY_SCALES[country]?.[city] ?? 0), 0)
}

// Animates a formatted number string (e.g. "12.93K") from its previous value to the new one
function useAnimatedValue(target) {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(parseNum(target))
  const rafRef  = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    const to   = parseNum(target)
    if (from === to) { setDisplay(target); return }

    const duration = 1800
    const start    = performance.now()

    function tick(now) {
      const t      = Math.min((now - start) / duration, 1)
      const eased  = 1 - Math.pow(1 - t, 3)          // ease-out cubic
      const cur    = from + (to - from) * eased
      setDisplay(fmtNum(cur, target))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
        setDisplay(target)
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target])

  return display
}

function scaleRowData(data, scale) {
  if (scale === 1) return data
  return data.map(row => Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * scale) : v])
  ))
}

// ── Date range helpers ────────────────────────────────────────────────────────
const _D_MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const _D_TODAY   = new Date()
const _TIME_KEYS = ['express','ground','priority','sameDay','standard']

function buildTimeData(baseData, range) {
  const weeklyTotals = _TIME_KEYS.reduce((acc, k) => {
    acc[k] = baseData.reduce((s, r) => s + (r[k] || 0), 0)
    return acc
  }, {})
  const dailyAvg = _TIME_KEYS.reduce((acc, k) => { acc[k] = weeklyTotals[k] / 7; return acc }, {})

  if (range === '5D') {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(_D_TODAY); d.setDate(d.getDate() - (4 - i))
      return { ...baseData[i % baseData.length], date: `${_D_MONTHS[d.getMonth()]} ${d.getDate()}` }
    })
  }
  if (range === '1M') {
    return Array.from({ length: 5 }, (_, wi) => {
      const d = new Date(_D_TODAY); d.setDate(d.getDate() - (4 - wi) * 7)
      const v = 0.82 + wi * 0.055
      return _TIME_KEYS.reduce((row, k) => { row[k] = Math.round(weeklyTotals[k] * v); return row },
        { date: `${_D_MONTHS[d.getMonth()]} ${d.getDate()}` })
    })
  }
  if (range === '6M') {
    return Array.from({ length: 6 }, (_, mi) => {
      const d = new Date(_D_TODAY.getFullYear(), _D_TODAY.getMonth() - (5 - mi), 1)
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const v = 0.78 + mi * 0.04
      return _TIME_KEYS.reduce((row, k) => { row[k] = Math.round(dailyAvg[k] * daysInMonth * v); return row },
        { date: _D_MONTHS[d.getMonth()] })
    })
  }
  if (range === 'YTD') {
    const curMonth = _D_TODAY.getMonth()
    return Array.from({ length: curMonth + 1 }, (_, mi) => {
      const days = mi === curMonth ? _D_TODAY.getDate() : new Date(_D_TODAY.getFullYear(), mi + 1, 0).getDate()
      const v = 0.88 + mi * 0.06
      return _TIME_KEYS.reduce((row, k) => { row[k] = Math.round(dailyAvg[k] * days * v); return row },
        { date: _D_MONTHS[mi] })
    })
  }
  return baseData
}

// Multiplier vs. 7-day base — scales carrier totals and failure counts to match range
const _ytdDays = Math.floor((_D_TODAY - new Date(_D_TODAY.getFullYear(), 0, 1)) / 86400000) + 1
const RANGE_MULTIPLIER = { '5D': 0.85, '1M': 4.1, '6M': 23.5, 'YTD': _ytdDays / 7 }

// KPI card jitter per range — 1M is baseline (1.00), others vary ±3–14%
// 12 values = one per KPI card slot (kpi1[0..5] then kpi2[0..5])
const RANGE_KPI_JITTER = {
  '5D':  [0.94, 1.02, 0.97, 0.91, 0.96, 1.04, 0.98, 1.06, 0.93, 0.99, 1.02, 0.95],
  '1M':  [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
  '6M':  [1.07, 0.95, 1.11, 1.09, 1.03, 0.91, 1.08, 0.96, 1.13, 1.04, 0.93, 1.06],
  'YTD': [1.04, 1.10, 0.95, 1.13, 1.08, 0.90, 1.05, 1.12, 0.97, 1.09, 0.94, 1.11],
}

// Generates status (failure-rate %) rows for the selected range with real dates
function buildStatusData(baseStatus, range) {
  const avg = {
    delivered: baseStatus.reduce((s, r) => s + r.delivered, 0) / baseStatus.length,
    failed:    baseStatus.reduce((s, r) => s + r.failed,    0) / baseStatus.length,
    canceled:  baseStatus.reduce((s, r) => s + r.canceled,  0) / baseStatus.length,
  }
  function row(date, v) {
    const delivered = Math.min(98, Math.round(avg.delivered * v))
    const failed    = Math.max(1,  Math.round(avg.failed    * (2 - v)))
    const canceled  = Math.max(0,  100 - delivered - failed)
    return { date, delivered, failed, canceled }
  }
  if (range === '5D') {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(_D_TODAY); d.setDate(d.getDate() - (4 - i))
      return { ...baseStatus[i % baseStatus.length], date: `${_D_MONTHS[d.getMonth()]} ${d.getDate()}` }
    })
  }
  if (range === '1M') {
    return Array.from({ length: 5 }, (_, wi) => {
      const d = new Date(_D_TODAY); d.setDate(d.getDate() - (4 - wi) * 7)
      return row(`${_D_MONTHS[d.getMonth()]} ${d.getDate()}`, 0.97 + wi * 0.005)
    })
  }
  if (range === '6M') {
    return Array.from({ length: 6 }, (_, mi) => {
      const d = new Date(_D_TODAY.getFullYear(), _D_TODAY.getMonth() - (5 - mi), 1)
      return row(_D_MONTHS[d.getMonth()], 0.91 + mi * 0.015)
    })
  }
  if (range === 'YTD') {
    return Array.from({ length: _D_TODAY.getMonth() + 1 }, (_, mi) => {
      return row(_D_MONTHS[mi], 0.90 + mi * 0.007)
    })
  }
  return baseStatus
}

// ── KPI trend helpers ──────────────────────────────────────────────────────────
const KPI_GOOD_DIR = {
  'Shipment Time (hrs) - P95':  'down',
  'Unit Sales (Daily Avg)':      'up',
  'Max Shipment Delay (hrs)':    'down',
  'Order Count (All Carriers)':  'up',
  'Total Dock Time (s)':         'down',
  'Damage Rate - Avg':           'down',
  'Peak Queue (#) - P95':        'down',
  'Peak Pickers (#) - P95':      'up',
  'Dock Wait Time (s) - Avg':    'down',
  '% Idle Time - Avg':           'down',
  'Pallets Loaded - Avg':        'up',
  'Returns Processed - Avg':     'down',
}
// Magnitude scales by range — longer periods naturally show larger % swings
const TREND_RANGE_SCALE = { '5D': 0.3, '1M': 0.7, '6M': 1.6, 'YTD': 2.4 }

function getKpiTrend(label, country, dateRange = '1M') {
  const seed      = (label.length * 11 + country.length * 7) % 19
  const rangeSeed = (seed + (dateRange.length * 5)) % 19
  const base      = 0.5 + rangeSeed * 0.38
  const scale     = TREND_RANGE_SCALE[dateRange] ?? 1
  const magnitude = parseFloat((base * scale).toFixed(1))
  const sign      = (label.length + country.length + dateRange.length) % 4 !== 0 ? 1 : -1
  return sign * magnitude
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const fmtK   = v => v >= 1000000 ? `${(v/1000000).toFixed(2)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v

const CARRIER_KEYS  = ['express','ground','priority','sameDay','standard','freight','returns','unknown']
const LEGEND_ITEMS  = [
  ['EXPRESS', C.express], ['GROUND',   C.ground],
  ['PRIORITY',C.priority],['SAME DAY', C.sameDay],
  ['STANDARD',C.standard],['FREIGHT',  C.freight],
  ['RETURNS', C.returns], ['UNKNOWN',  C.unknown],
]

// ── Shipment chart tooltip — shifts left/right so it never covers the active bar ──
function ShipmentTooltip({ active, payload, label, coordinate, viewBox, T, formatter }) {
  if (!active || !payload?.length) return null
  // Compare bar x to the midpoint of the actual plot area (viewBox.x is the left margin offset)
  const midpoint = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) / 2
  const toRight  = (coordinate?.x ?? 0) <= midpoint
  const fmt = formatter ?? (v => Number(v).toLocaleString())
  return (
    <div style={{
      backgroundColor: T.tooltipBg,
      border: `1px solid ${T.tooltipBorder}`,
      color: T.text,
      fontSize: 11,
      borderRadius: 6,
      padding: '8px 10px',
      pointerEvents: 'none',
      // toRight: shift right so left edge clears the bar
      // toLeft:  translateX(-100%) moves right edge to wrapper origin, then subtract gap
      ...(toRight ? { marginLeft: 40 } : { transform: 'translateX(calc(-100% - 60px))' }),
    }}>
      <div style={{ marginBottom:4, fontWeight:600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', backgroundColor:p.fill, flexShrink:0 }}/>
          <span>{p.name}: {fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Small components ──────────────────────────────────────────────────────────
function SwatchLegend({ items, col }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', flexDirection: col ? 'column' : 'row', gap: col ? 3 : 8, marginTop:8 }}>
      {items.map(([label, color]) => (
        <span key={label} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#888' }}>
          <span style={{ width:9, height:9, backgroundColor:color, display:'inline-block', flexShrink:0 }} />
          {label}
        </span>
      ))}
    </div>
  )
}

function KpiCard({ label, sublabel, primary, secondary, secondaryLabel, country, dateRange, isDragging, isOver, dragHandlers, T }) {
  const trend      = getKpiTrend(label, country, dateRange)
  const goodDir    = KPI_GOOD_DIR[label] || 'up'
  const isGood     = (trend > 0 && goodDir === 'up') || (trend < 0 && goodDir === 'down')
  const trendColor = isGood ? '#4caf50' : '#f44336'
  const arrow      = trend > 0 ? '↑' : '↓'
  const animPrimary   = useAnimatedValue(primary)
  const animSecondary = useAnimatedValue(secondary || '')
  return (
    <div
      {...dragHandlers}
      style={{
        backgroundColor: T.cardBg, border: `1px solid ${T.cardBorder}`, padding:'18px 20px',
        display:'flex', flexDirection:'column',
        cursor:'grab',
        opacity: isDragging ? 0.35 : 1,
        outline: (isDragging || isOver) ? '2px solid #00bcd4' : '2px solid transparent',
        transition:'opacity 0.15s, outline 0.1s',
        userSelect:'none',
      }}
    >
      <div style={{ minHeight:48 }}>
        <div style={{ color:'#80cbc4', fontSize:12, fontWeight:500, lineHeight:1.3 }}>{label}</div>
      </div>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8, marginTop:8 }}>
        <div key={primary} className="kpi-flip" style={{ color: T.text, fontSize:26, fontWeight:700, lineHeight:1.1 }}>{animPrimary}</div>
        <span key={trend} className="kpi-flip" style={{ fontSize:16, fontWeight:700, color: trendColor, whiteSpace:'nowrap' }}>
          {arrow} {Math.abs(trend)}%
        </span>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [country, setCountry] = useState('United States')
  const [selectedCities, setSelectedCities] = useState([])   // [] = "All"
  const [locationMenuOpen, setLocationMenuOpen] = useState(false)
  const [view, setView] = useState('dashboard')
  const [selectedKpiLabel, setSelectedKpiLabel] = useState(null)
  const [theme, setTheme] = useState('dark')
  const [dateRange, setDateRange] = useState('1M')
  // Dashboard doesn't support 1D — clamp to 5D if arriving from unit sales
  const dashboardRange = dateRange === '1D' ? '5D' : dateRange
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const T = THEME[theme]
  const dashboardRef = useRef(null)

  // ── Carrier chart: fix tooltip position to top bar (highest orders) ──
  const [carrierTipPos, setCarrierTipPos] = useState(null)
  useEffect(() => { setCarrierTipPos(null) }, [country])

  // ── Export helpers ──
  function exportCSV() {
    const d = COUNTRY_DATA[country]
    const rangeJitter = RANGE_KPI_JITTER[dashboardRange] ?? RANGE_KPI_JITTER['1M']
    const cards = [...d.kpi1, ...d.kpi2].map((k, i) => {
      const factor = getMultiCityScale(country, selectedCities) * (rangeJitter[i] ?? 1)
      return { ...k, primary: factor === 1 ? k.primary : scaleStr(k.primary, factor) }
    })

    const rows = [
      ['Dashboard Export', `${country} | ${dashboardRange} | ${new Date().toLocaleString()}`],
      [],
      ['KPI Cards'],
      ['Label', 'Value'],
      ...cards.map(k => [k.label, k.primary]),
      [],
      ['Shipment Count Over Time'],
      ['Date', 'Express', 'Ground', 'Priority', 'Same Day', 'Standard'],
      ...buildTimeData(scaleRowData(d.time, getMultiCityScale(country, selectedCities)), dashboardRange)
        .map(r => [r.date, r.express ?? '', r.ground ?? '', r.priority ?? '', r.sameDay ?? '', r.standard ?? '']),
      [],
      ['Delivery Status Over Time'],
      ['Date', 'Delivered %', 'Failed %', 'Canceled %'],
      ...buildStatusData(d.status, dashboardRange).map(r => [r.date, r.delivered, r.failed, r.canceled]),
    ]

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `warehouseiq-${country.replace(/\s+/g, '-').toLowerCase()}-${dashboardRange}.csv`)
  }

  async function exportPDF() {
    if (!dashboardRef.current) return
    const canvas = await html2canvas(dashboardRef.current, {
      scale: 2,
      backgroundColor: T.bg,
      useCORS: true,
    })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
    pdf.save(`warehouseiq-${country.replace(/\s+/g, '-').toLowerCase()}-${dashboardRange}.pdf`)
  }

  async function exportChartPNG() {
    if (!dashboardRef.current) return
    const chartGrid = dashboardRef.current.querySelector('.chart-grid')
    if (!chartGrid) return
    const canvas = await html2canvas(chartGrid, {
      scale: 2,
      backgroundColor: T.panelBg,
      useCORS: true,
    })
    canvas.toBlob(blob => saveAs(blob, `warehouseiq-charts-${country.replace(/\s+/g, '-').toLowerCase()}-${dashboardRange}.png`))
  }
  const panel = { backgroundColor: T.panelBg, border: `1px solid ${T.border}`, padding:'14px 16px' }
  const ttip  = { backgroundColor: T.tooltipBg, border: `1px solid ${T.tooltipBorder}`, color: T.text, fontSize:11 }
  const d = COUNTRY_DATA[country]

  // ── KPI drag-and-drop ──
  const [kpiCards, setKpiCards] = useState([...d.kpi1, ...d.kpi2])
  const [dragIdx, setDragIdx]     = useState(null)
  const [overIdx, setOverIdx]     = useState(null)
  const [pressedIdx, setPressedIdx] = useState(null)
  const dragNode = useRef(null)

  useEffect(() => {
    setKpiCards([...COUNTRY_DATA[country].kpi1, ...COUNTRY_DATA[country].kpi2])
  }, [country])

  function handleDragStart(e, i) {
    dragNode.current = i
    setDragIdx(i)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e, i) {
    e.preventDefault()
    if (i !== overIdx) setOverIdx(i)
  }
  function handleDrop(e, i) {
    e.preventDefault()
    const from = dragNode.current
    if (from === i) return
    setKpiCards(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(i, 0, item)
      return next
    })
    setDragIdx(null)
    setOverIdx(null)
  }
  function handleDragEnd() {
    setDragIdx(null)
    setOverIdx(null)
    setPressedIdx(null)
  }

  // ── Chart drag-and-drop ──
  const [chartOrder, setChartOrder]         = useState(['carrier','time','failure','status'])
  const [chartDragIdx, setChartDragIdx]     = useState(null)
  const [chartOverIdx, setChartOverIdx]     = useState(null)
  const [chartPressedIdx, setChartPressedIdx] = useState(null)
  const chartDragNode = useRef(null)

  function handleChartDragStart(e, i) {
    chartDragNode.current = i
    setChartDragIdx(i)
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleChartDragOver(e, i) {
    e.preventDefault()
    if (i !== chartOverIdx) setChartOverIdx(i)
  }
  function handleChartDrop(e, i) {
    e.preventDefault()
    const from = chartDragNode.current
    if (from === i) return
    setChartOrder(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(i, 0, item)
      return next
    })
    setChartDragIdx(null)
    setChartOverIdx(null)
  }
  function handleChartDragEnd() {
    setChartDragIdx(null)
    setChartOverIdx(null)
    setChartPressedIdx(null)
  }

  const cityScale = getMultiCityScale(country, selectedCities)
  const locationLabel = selectedCities.length === 0
    ? 'All'
    : selectedCities.length === 1
      ? selectedCities[0]
      : 'Multiple'
  const rangeJitter = RANGE_KPI_JITTER[dashboardRange] ?? RANGE_KPI_JITTER['1M']
  const displayKpiCards = kpiCards.map((k, i) => {
    const factor = cityScale * (rangeJitter[i] ?? 1)
    if (factor === 1) return k
    return { ...k, primary: scaleStr(k.primary, factor), secondary: scaleStr(k.secondary, factor) }
  })

  const rangeMultiplier = RANGE_MULTIPLIER[dashboardRange] ?? 1
  const scaledCarriers = scaleRowData(d.carriers, cityScale * rangeMultiplier)
  const scaledFailure  = scaleRowData(d.failure,  cityScale * rangeMultiplier)
  const timeData       = buildTimeData(scaleRowData(d.time, cityScale), dashboardRange)
  const statusData     = buildStatusData(d.status, dashboardRange)

  const carrierData = scaledCarriers.map(r => ({
    ...r,
    _total: CARRIER_KEYS.reduce((s, k) => s + (r[k] || 0), 0),
  }))

  if (view === 'geo') {
    return (
      <div style={{ backgroundColor: T.bg, minHeight:'100vh', fontFamily:'Inter, system-ui, sans-serif', color: T.text }}>
        {/* ── Menu bar ── */}
        <div style={{ backgroundColor: T.navBg, borderBottom: `1px solid ${T.border}`, height:40, display:'flex', alignItems:'center', padding:'0 16px', gap:16 }}>
          <span style={{ fontSize:13, fontWeight:700, color: T.text, letterSpacing:'0.02em' }}>WarehouseIQ</span>
          <span style={{ color: T.sep, fontSize:12 }}>|</span>
          {[{id:'dashboard', label:'Dashboard'}, {id:'detail', label:'Unit Sales'}, {id:'geo', label:'Geo'}, {id:'inventory', label:'Inventory'}].map(tab => (
            <button key={tab.id} onClick={() => { if (tab.id === 'detail') setSelectedKpiLabel('Unit Sales (Daily Avg)'); setView(tab.id) }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize:12, fontWeight: view === tab.id ? 700 : 400,
              color: view === tab.id ? '#00bcd4' : T.textMuted,
              borderBottom: view === tab.id ? '2px solid #00bcd4' : '2px solid transparent',
              padding: '0 4px', height:40,
            }}>{tab.label}</button>
          ))}
          <span style={{ color: T.sep, fontSize:12 }}>|</span>
          <div style={{ display:'flex', gap:4 }}>
            {['5D','1M','6M','YTD'].map(r => (
              <button key={r} onClick={() => setDateRange(r)} style={{
                background: r === dateRange ? '#00bcd4' : 'transparent',
                color:      r === dateRange ? '#111' : T.textDim,
                border: `1px solid #00bcd4`, fontSize:11, padding:'1.5px 0', width:42, textAlign:'center',
                borderRadius:4, cursor:'pointer', fontWeight: r === dateRange ? 700 : 400,
                transition:'all 0.15s',
              }}>{r}</button>
            ))}
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} style={{
              width:28, height:28, borderRadius:7, cursor:'pointer', border:`1px solid ${T.inputBorder}`,
              backgroundColor: theme === 'dark' ? '#1c1c1c' : '#f5f5f5',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Sun size={15} color={theme === 'dark' ? '#fff' : '#333'} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button title="Export data" style={{
                  width:28, height:28, borderRadius:7, cursor:'pointer', border:`1px solid ${T.inputBorder}`,
                  backgroundColor: theme === 'dark' ? '#1c1c1c' : '#f5f5f5',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <Download size={15} color={theme === 'dark' ? '#fff' : '#333'} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth:180 }}>
                <DropdownMenuItem onClick={exportCSV} style={{ fontSize:12, cursor:'pointer', color: T.textMuted, gap:8 }}>
                  <Download size={12} /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF} style={{ fontSize:12, cursor:'pointer', color: T.textMuted, gap:8 }}>
                  <Download size={12} /> Export PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportChartPNG} style={{ fontSize:12, cursor:'pointer', color: T.textMuted, gap:8 }}>
                  <Download size={12} /> Save Charts as PNG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <img
              src="/avatar.jpg"
              alt="User account"
              style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', marginLeft:4, border:`1px solid ${T.inputBorder}`, flexShrink:0 }}
            />
          </div>
        </div>
        <style>{`
          .geo-scroll::-webkit-scrollbar { width: 8px; }
          .geo-scroll::-webkit-scrollbar-track { background: ${T.panelBg}; }
          .geo-scroll::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
          .geo-scroll::-webkit-scrollbar-thumb:hover { background: #00bcd4; }
        `}</style>
        <div
          className="geo-scroll"
          style={{ height: 'calc(100vh - 40px)', overflowY: 'scroll', scrollbarWidth: 'thin', scrollbarColor: `${T.border} ${T.panelBg}` }}
        >
          <GeoScreen countryData={COUNTRY_DATA} theme={theme} T={T} dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>
      </div>
    )
  }

  if (view === 'inventory') {
    return (
      <InventoryScreen
        theme={theme}
        T={T}
        country={country}
        selectedCities={selectedCities}
        countries={COUNTRIES}
        cities={CITY_LISTS[country]}
        onCountryChange={c => { setCountry(c); setSelectedCities([]) }}
        onLocationChange={setSelectedCities}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        setView={setView}
        onThemeToggle={toggleTheme}
      />
    )
  }

  if (view === 'detail') {
    const kpiLabel = selectedKpiLabel || 'Unit Sales (Daily Avg)'
    const currentKpi = [...COUNTRY_DATA[country].kpi1, ...COUNTRY_DATA[country].kpi2]
      .find(k => k.label === kpiLabel) || kpiCards[0]
    return (
      <KpiDetailPage
        kpi={currentKpi}
        country={country}
        selectedCities={selectedCities}
        cities={CITY_LISTS[country]}
        cityScales={CITY_SCALES}
        countries={COUNTRIES}
        onBack={(target) => setView(target ?? 'dashboard')}
        onCountryChange={c => { setCountry(c); setSelectedCities([]) }}
        onLocationChange={setSelectedCities}
        theme={theme}
        onThemeToggle={toggleTheme}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
    )
  }

  return (
    <div style={{ backgroundColor: T.bg, minHeight:'100vh', fontFamily:'Inter, system-ui, sans-serif', color: T.text }}>

      {/* ── Menu bar ── */}
      <div style={{ position:'sticky', top:0, zIndex:10, backgroundColor: T.navBg, borderBottom: `1px solid ${T.border}`, height:40, display:'flex', alignItems:'center', padding:'0 16px', gap:16 }}>
        <span style={{ fontSize:13, fontWeight:700, color: T.text, letterSpacing:'0.02em' }}>
          WarehouseIQ
        </span>
        <span style={{ color: T.sep, fontSize:12 }}>|</span>
        {[{id:'dashboard', label:'Dashboard'}, {id:'detail', label:'Unit Sales'}, {id:'geo', label:'Geo'}, {id:'inventory', label:'Inventory'}].map(tab => (
          <button key={tab.id} onClick={() => { if (tab.id === 'detail') setSelectedKpiLabel('Unit Sales (Daily Avg)'); setView(tab.id) }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize:12, fontWeight: view === tab.id ? 700 : 400,
            color: view === tab.id ? '#00bcd4' : T.textMuted,
            borderBottom: view === tab.id ? '2px solid #00bcd4' : '2px solid transparent',
            padding: '0 4px', height:40,
          }}>{tab.label}</button>
        ))}
        <span style={{ color: T.sep, fontSize:12 }}>|</span>
        <div style={{ display:'flex', gap:4 }}>
          {['5D','1M','6M','YTD'].map(r => (
            <button key={r} onClick={() => setDateRange(r)} style={{
              background: r === dashboardRange ? '#00bcd4' : 'transparent',
              color:      r === dashboardRange ? '#111' : T.textDim,
              border: `1px solid #00bcd4`, fontSize:11, padding:'1.5px 0', width:42, textAlign:'center',
              borderRadius:4, cursor:'pointer', fontWeight: r === dashboardRange ? 700 : 400,
              transition:'all 0.15s',
            }}>{r}</button>
          ))}
        </div>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color: T.textDim }}>Country:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={{
                backgroundColor: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.inputText,
                fontSize:12, padding:'4px 10px', borderRadius:4, cursor:'pointer',
                display:'flex', alignItems:'center', gap:6,
              }}>
                {country}
                <span style={{ color: T.textDim, fontSize:10 }}>▼</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth:160 }}>
              {COUNTRIES.map(c => (
                <DropdownMenuItem
                  key={c}
                  onClick={() => { setCountry(c); setSelectedCities([]) }}
                  style={{
                    color: c === country ? '#00bcd4' : T.textMuted,
                    fontSize:12, cursor:'pointer',
                    backgroundColor: c === country ? T.activeItemBg : 'transparent',
                  }}
                >
                  {c}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span style={{ fontSize:11, color: T.textDim }}>Location:</span>
          <DropdownMenu open={locationMenuOpen} onOpenChange={setLocationMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button style={{ backgroundColor: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.inputText, fontSize:12, padding:'4px 10px', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                {locationLabel}
                <span style={{ color: T.textDim, fontSize:10 }}>▼</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth:160 }}>
              <DropdownMenuItem
                key="All"
                closeOnClick={false}
                onClick={() => { setSelectedCities([]); setLocationMenuOpen(false) }}
                style={{ color: selectedCities.length === 0 ? '#00bcd4' : T.textMuted, fontSize:12, cursor:'pointer', backgroundColor: selectedCities.length === 0 ? T.activeItemBg : 'transparent' }}
              >
                All
              </DropdownMenuItem>
              {CITY_LISTS[country].filter(c => c !== 'All').map(c => {
                const isSelected = selectedCities.includes(c)
                return (
                  <DropdownMenuItem
                    key={c}
                    closeOnClick={false}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        setSelectedCities(prev => {
                          const next = prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                          const allCities = CITY_LISTS[country].filter(x => x !== 'All')
                          return next.length === allCities.length ? [] : next
                        })
                      } else {
                        setSelectedCities([c])
                        setLocationMenuOpen(false)
                      }
                    }}
                    style={{ color: isSelected ? '#00bcd4' : T.textMuted, fontSize:12, cursor:'pointer', backgroundColor: isSelected ? T.activeItemBg : 'transparent' }}
                  >
                    {c}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width:28, height:28, borderRadius:7, cursor:'pointer', border:`1px solid ${T.inputBorder}`,
              backgroundColor: theme === 'dark' ? '#1c1c1c' : '#f5f5f5',
              display:'flex', alignItems:'center', justifyContent:'center',
              marginLeft:4,
            }}
          >
            <Sun size={15} color={theme === 'dark' ? '#fff' : '#333'} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Export data"
                style={{
                  width:28, height:28, borderRadius:7, cursor:'pointer', border:`1px solid ${T.inputBorder}`,
                  backgroundColor: theme === 'dark' ? '#1c1c1c' : '#f5f5f5',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}
              >
                <Download size={15} color={theme === 'dark' ? '#fff' : '#333'} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ backgroundColor: T.dropdownBg, border: `1px solid ${T.dropdownBorder}`, minWidth:180 }}>
              <DropdownMenuItem onClick={exportCSV} style={{ fontSize:12, cursor:'pointer', color: T.textMuted, gap:8 }}>
                <Download size={12} /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF} style={{ fontSize:12, cursor:'pointer', color: T.textMuted, gap:8 }}>
                <Download size={12} /> Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportChartPNG} style={{ fontSize:12, cursor:'pointer', color: T.textMuted, gap:8 }}>
                <Download size={12} /> Save Charts as PNG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <img
            src="/avatar.jpg"
            alt="User account"
            style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover', marginLeft:8, border:`1px solid ${T.inputBorder}`, flexShrink:0 }}
          />
        </div>
      </div>

      {/* ── Dashboard body ── */}
      <div ref={dashboardRef} style={{ padding:'12px 14px' }}>

        {/* KPI cards — draggable */}
        <div className="kpi-grid">
          {displayKpiCards.map((kpi, i) => (
            <KpiCard
              key={kpi.label + kpi.primary}
              {...kpi}
              country={country}
              dateRange={dashboardRange}
              isDragging={dragIdx === i}
              isOver={(overIdx === i && dragIdx !== i) || pressedIdx === i}
              T={T}
              dragHandlers={{
                draggable: true,
                onMouseDown: () => setPressedIdx(i),
                onMouseUp:   () => setPressedIdx(null),
                onDragStart: e => handleDragStart(e, i),
                onDragOver:  e => handleDragOver(e, i),
                onDrop:      e => handleDrop(e, i),
                onDragEnd:   handleDragEnd,
                onDoubleClick: () => { setSelectedKpiLabel('Unit Sales'); setView('detail') },
              }}
            />
          ))}
        </div>

        {/* Section header */}
        <div style={{ fontSize:15, fontWeight:600, margin:'18px 0 12px', paddingBottom:8, borderBottom:`1px solid ${T.border}`, color: T.text }}>
          Warehouse Operations Charts — {selectedCities.length === 0 ? country : selectedCities.length === 1 ? `${country} › ${selectedCities[0]}` : `${country} +${selectedCities.length}`}
        </div>

        {/* Charts — draggable 2-column grid */}
        <div className="chart-grid">
          {chartOrder.map((id, ci) => {
            const isChartDragging = chartDragIdx === ci
            const isChartOver    = (chartOverIdx === ci && chartDragIdx !== ci) || chartPressedIdx === ci
            const chartPanelStyle = {
              ...panel,
              cursor: 'grab',
              userSelect: 'none',
              opacity: isChartDragging ? 0.35 : 1,
              outline: (isChartDragging || isChartOver) ? '2px solid #00bcd4' : '2px solid transparent',
              transition: 'opacity 0.15s, outline 0.1s',
            }
            const dragProps = {
              draggable: true,
              onMouseDown: () => setChartPressedIdx(ci),
              onMouseUp:   () => setChartPressedIdx(null),
              onDragStart: e => handleChartDragStart(e, ci),
              onDragOver:  e => handleChartDragOver(e, ci),
              onDrop:      e => handleChartDrop(e, ci),
              onDragEnd:   handleChartDragEnd,
            }

            if (id === 'carrier') return (
              <div key={id} style={chartPanelStyle} {...dragProps}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:10, color: T.text }}>Orders by Carrier &amp; Type</div>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <ResponsiveContainer width="100%" height={Math.max(360, carrierData.length * 34)}>
                      <BarChart layout="vertical" data={carrierData} margin={{ top:0, right:60, bottom:0, left:0 }} barSize={12}
                        onMouseMove={e => {
                          if (!carrierTipPos && e?.activeTooltipIndex === 0 && e?.activeCoordinate) {
                            setCarrierTipPos({ x: e.activeCoordinate.x, y: e.activeCoordinate.y })
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} horizontal={false} />
                        <XAxis type="number" stroke={T.border} tick={{ fill: T.axTick, fontSize:10 }} tickFormatter={fmtK} />
                        <YAxis type="category" dataKey="carrier" stroke={T.border} width={160}
                          tick={{ fill: T.axTick, fontSize:10 }} interval={0} />
                        <Tooltip contentStyle={ttip} formatter={v => v.toLocaleString()} position={carrierTipPos || undefined} />
                        {CARRIER_KEYS.map((k, ki) => (
                          <Bar key={k} dataKey={k} stackId="a" fill={C[k]} name={k.replace('sameDay','SAME DAY').toUpperCase()}>
                            {ki === CARRIER_KEYS.length - 1 && (
                              <LabelList dataKey="_total" position="right"
                                content={({ x, y, width, height, value }) =>
                                  value > 0
                                    ? <text x={x+width+4} y={y+height/2} fill={T.textMuted} fontSize={10} dominantBaseline="middle">{value.toLocaleString()}</text>
                                    : null
                                }
                              />
                            )}
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <SwatchLegend items={LEGEND_ITEMS} col />
                </div>
              </div>
            )

            if (id === 'time') return (
              <div key={id} style={chartPanelStyle} {...dragProps}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:600, color: T.text }}>Shipment Count Over Time</span>
                  <span style={{ fontSize:10, color: T.textDim }}>
                    — {dashboardRange === '5D' ? 'Last 5 Days' : dashboardRange === '1M' ? 'Last Month' : dashboardRange === '6M' ? 'Last 6 Months' : 'Year to Date'}
                    {dashboardRange !== 'YTD' && ` (${timeData[0]?.date} – ${timeData[timeData.length-1]?.date})`}
                  </span>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={timeData} margin={{ top:10, right:10, bottom:28, left:14 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} vertical={false} />
                        <XAxis dataKey="date" stroke={T.border}
                          tick={{ fill: T.axTick, fontSize:10 }}
                          label={{ value: dashboardRange === '6M' ? 'Month' : 'Ship Date', position:'insideBottom', offset:-14, fill: T.textDim, fontSize:10 }} />
                        <YAxis stroke={T.border} tick={{ fill: T.axTick, fontSize:10 }} tickFormatter={fmtK}
                          label={{ value:'Count of Orders', angle:-90, position:'insideLeft', offset:10, fill: T.textDim, fontSize:10 }} />
                        <Tooltip content={<ShipmentTooltip T={T} />} allowEscapeViewBox={{ x: true, y: false }} />
                        {['express','ground','priority','sameDay','standard'].map(k => (
                          <Bar key={k} dataKey={k} stackId="a" fill={C[k]} name={k.replace('sameDay','SAME DAY').toUpperCase()}>
                            <LabelList dataKey={k} position="center"
                              content={({ x, y, width, height, value }) =>
                                value > 800
                                  ? <text x={x+width/2} y={y+height/2} fill="#fff" fontSize={9} textAnchor="middle" dominantBaseline="middle">{value.toLocaleString()}</text>
                                  : null
                              }
                            />
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <SwatchLegend items={LEGEND_ITEMS.slice(0,5)} col />
                </div>
              </div>
            )

            if (id === 'failure') return (
              <div key={id} style={chartPanelStyle} {...dragProps}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:10, color: T.text }}>Order Failure Rate</div>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart layout="vertical" data={scaledFailure} margin={{ left:10, right:20 }} barSize={30}>
                    <XAxis type="number" stroke={T.border} tick={{ fill: T.axTick, fontSize:10 }}
                      tickFormatter={v => {
                        const total = scaledFailure[0].delivered + scaledFailure[0].failed + scaledFailure[0].canceled
                        return `${Math.round((v / total) * 100)}%`
                      }}
                    />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip contentStyle={ttip} formatter={v => v.toLocaleString()} />
                    <Bar dataKey="delivered" stackId="a" fill={C.delivered} name="DELIVERED">
                      <LabelList dataKey="delivered" position="center"
                        content={({ x, y, width, height, value }) =>
                          <text x={x+width/2} y={y+height/2} fill="#fff" fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="middle">{value.toLocaleString()}</text>
                        }
                      />
                    </Bar>
                    <Bar dataKey="failed"   stackId="a" fill={C.failed}   name="FAILED" />
                    <Bar dataKey="canceled" stackId="a" fill={C.canceled} name="CANCELED" />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', justifyContent:'space-between', color: T.textDim, fontSize:10, marginTop:2 }}>
                  <span>0%</span><span>% of Orders</span><span>100%</span>
                </div>
                <SwatchLegend items={[['CANCELED',C.canceled],['FAILED',C.failed],['DELIVERED',C.delivered]]} />
              </div>
            )

            if (id === 'status') return (
              <div key={id} style={chartPanelStyle} {...dragProps}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:10, color: T.text }}>Orders By Status (Failure Rate)</div>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={statusData} margin={{ top:4, right:10, bottom:28, left:14 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={T.chartGrid} vertical={false} />
                        <XAxis dataKey="date" stroke={T.border}
                          tick={{ fill: T.axTick, fontSize:10 }}
                          label={{ value: dashboardRange === '6M' ? 'Month' : 'Ship Date', position:'insideBottom', offset:-14, fill: T.textDim, fontSize:10 }} />
                        <YAxis stroke={T.border} tick={{ fill: T.axTick, fontSize:10 }} tickFormatter={v => `${v}%`} domain={[0,100]} />
                        <Tooltip content={<ShipmentTooltip T={T} formatter={v => `${v}%`} />} allowEscapeViewBox={{ x: true, y: false }} />
                        <Bar dataKey="canceled"  stackId="a" fill={C.canceled}  name="CANCELED" />
                        <Bar dataKey="failed"    stackId="a" fill={C.failed}    name="FAILED" />
                        <Bar dataKey="delivered" stackId="a" fill={C.delivered} name="DELIVERED" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <SwatchLegend items={[['CANCELED',C.canceled],['FAILED',C.failed],['DELIVERED',C.delivered]]} col />
                </div>
              </div>
            )

            return null
          })}
        </div>
      </div>
    </div>
  )
}
