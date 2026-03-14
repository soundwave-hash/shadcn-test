import { useState, useRef, useEffect } from 'react'
import './App.css'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
      { label:'Shipment Time (hrs) - P95',   sublabel:'P99',           primary:'8.64',   secondary:'21.54' },
      { label:'Processing Time (hrs) - Avg', sublabel:'Median',        primary:'3.62',   secondary:'0.47'  },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'17.41K', secondary:''      },
      { label:'Order Count',                 sublabel:'Carrier Count', primary:'95.76K', secondary:'756'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'604.8K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'P99',           primary:'0.03',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'14.85', secondary:'0'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'30',    secondary:'4'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.17',  secondary:'0.32' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.03',  secondary:'0.16' },
      { label:'Pallets Loaded - Avg',     sublabel:'P99', primary:'0.27',  secondary:'0.29' },
      { label:'Returns Processed - Avg',  sublabel:'P99', primary:'0.02',  secondary:'0'    },
    ],
    carriers: [
      { carrier:'CDL Last Mile',    express:0,     ground:650,   priority:0,    sameDay:0,    standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'Courier Express',  express:0,     ground:800,   priority:0,    sameDay:0,    standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'Spee-Dee',         express:0,     ground:1100,  priority:0,    sameDay:0,    standard:100, freight:0, returns:0,   unknown:0     },
      { carrier:'GSO',              express:100,   ground:1700,  priority:0,    sameDay:0,    standard:100, freight:0, returns:0,   unknown:0     },
      { carrier:'LaserShip',        express:0,     ground:2600,  priority:100,  sameDay:0,    standard:100, freight:0, returns:0,   unknown:0     },
      { carrier:'OnTrac',           express:100,   ground:2900,  priority:100,  sameDay:0,    standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'Amazon Logistics', express:200,   ground:3800,  priority:0,    sameDay:200,  standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'DHL',              express:4800,  ground:0,     priority:200,  sameDay:100,  standard:0,   freight:0, returns:0,   unknown:0     },
      { carrier:'USPS Priority',    express:300,   ground:500,   priority:0,    sameDay:7200, standard:200, freight:0, returns:0,   unknown:0     },
      { carrier:'Unknown',          express:0,     ground:0,     priority:0,    sameDay:0,    standard:0,   freight:0, returns:0,   unknown:11852 },
      { carrier:'UPS Ground',       express:1000,  ground:28535, priority:1000, sameDay:0,    standard:500, freight:0, returns:500, unknown:0     },
      { carrier:'FedEx Express',    express:38541, ground:2500,  priority:1000, sameDay:500,  standard:0,   freight:0, returns:0,   unknown:0     },
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
      { label:'Shipment Time (hrs) - P95',   sublabel:'P99',           primary:'6.21',   secondary:'14.80' },
      { label:'Processing Time (hrs) - Avg', sublabel:'Median',        primary:'2.94',   secondary:'0.38'  },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'11.20K', secondary:''      },
      { label:'Order Count',                 sublabel:'Carrier Count', primary:'42.30K', secondary:'312'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'298.4K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'P99',           primary:'0.02',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'9.40',  secondary:'0'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'18',    secondary:'2'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.12',  secondary:'0.24' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.05',  secondary:'0.22' },
      { label:'Pallets Loaded - Avg',     sublabel:'P99', primary:'0.19',  secondary:'0.21' },
      { label:'Returns Processed - Avg',  sublabel:'P99', primary:'0.03',  secondary:'0'    },
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
      { label:'Shipment Time (hrs) - P95',   sublabel:'P99',           primary:'11.40',  secondary:'28.60' },
      { label:'Processing Time (hrs) - Avg', sublabel:'Median',        primary:'5.10',   secondary:'0.82'  },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'22.80K', secondary:''      },
      { label:'Order Count',                 sublabel:'Carrier Count', primary:'31.50K', secondary:'218'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'412.1K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'P99',           primary:'0.07',   secondary:'0.01'  },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'18.20', secondary:'2'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'22',    secondary:'5'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.31',  secondary:'0.58' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.09',  secondary:'0.28' },
      { label:'Pallets Loaded - Avg',     sublabel:'P99', primary:'0.41',  secondary:'0.44' },
      { label:'Returns Processed - Avg',  sublabel:'P99', primary:'0.06',  secondary:'0.01' },
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
      { label:'Shipment Time (hrs) - P95',   sublabel:'P99',           primary:'5.80',   secondary:'12.40' },
      { label:'Processing Time (hrs) - Avg', sublabel:'Median',        primary:'2.10',   secondary:'0.31'  },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'9.60K',  secondary:''      },
      { label:'Order Count',                 sublabel:'Carrier Count', primary:'68.20K', secondary:'480'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'521.3K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'P99',           primary:'0.01',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'11.20', secondary:'1'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'26',    secondary:'3'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.09',  secondary:'0.18' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.02',  secondary:'0.10' },
      { label:'Pallets Loaded - Avg',     sublabel:'P99', primary:'0.33',  secondary:'0.35' },
      { label:'Returns Processed - Avg',  sublabel:'P99', primary:'0.04',  secondary:'0'    },
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
      { label:'Shipment Time (hrs) - P95',   sublabel:'P99',           primary:'4.20',   secondary:'9.10'  },
      { label:'Processing Time (hrs) - Avg', sublabel:'Median',        primary:'1.80',   secondary:'0.22'  },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'7.30K',  secondary:''      },
      { label:'Order Count',                 sublabel:'Carrier Count', primary:'112.4K', secondary:'620'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'680.2K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'P99',           primary:'0.01',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'8.60',  secondary:'0'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'42',    secondary:'6'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.07',  secondary:'0.14' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.01',  secondary:'0.06' },
      { label:'Pallets Loaded - Avg',     sublabel:'P99', primary:'0.48',  secondary:'0.51' },
      { label:'Returns Processed - Avg',  sublabel:'P99', primary:'0.01',  secondary:'0'    },
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

  'Korea': {
    kpi1: [
      { label:'Shipment Time (hrs) - P95',   sublabel:'P99',           primary:'3.90',   secondary:'8.40'  },
      { label:'Processing Time (hrs) - Avg', sublabel:'Median',        primary:'1.60',   secondary:'0.19'  },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'6.80K',  secondary:''      },
      { label:'Order Count',                 sublabel:'Carrier Count', primary:'88.60K', secondary:'510'   },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'544.9K', secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'P99',           primary:'0.01',   secondary:'0'     },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'7.80',  secondary:'0'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'38',    secondary:'5'    },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.06',  secondary:'0.12' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.01',  secondary:'0.05' },
      { label:'Pallets Loaded - Avg',     sublabel:'P99', primary:'0.44',  secondary:'0.46' },
      { label:'Returns Processed - Avg',  sublabel:'P99', primary:'0.02',  secondary:'0'    },
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
      { label:'Shipment Time (hrs) - P95',   sublabel:'P99',           primary:'5.10',   secondary:'13.80' },
      { label:'Processing Time (hrs) - Avg', sublabel:'Median',        primary:'2.40',   secondary:'0.34'  },
      { label:'Max Shipment Delay (hrs)',     sublabel:'',              primary:'24.60K', secondary:''      },
      { label:'Order Count',                 sublabel:'Carrier Count', primary:'284.3K', secondary:'1,240' },
      { label:'Total Dock Time (s)',          sublabel:'',              primary:'1.82M',  secondary:''      },
      { label:'Damage Rate - Avg',           sublabel:'P99',           primary:'0.04',   secondary:'0.01'  },
    ],
    kpi2: [
      { label:'Peak Queue (#) - P95',     sublabel:'P50', primary:'22.40', secondary:'3'    },
      { label:'Peak Pickers (#) - P95',   sublabel:'P50', primary:'86',    secondary:'12'   },
      { label:'Dock Wait Time (s) - Avg', sublabel:'P95', primary:'0.14',  secondary:'0.29' },
      { label:'% Idle Time - Avg',        sublabel:'P95', primary:'0.02',  secondary:'0.11' },
      { label:'Pallets Loaded - Avg',     sublabel:'P99', primary:'0.62',  secondary:'0.66' },
      { label:'Returns Processed - Avg',  sublabel:'P99', primary:'0.05',  secondary:'0.01' },
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

// ── Shared styles ─────────────────────────────────────────────────────────────
const panel  = { backgroundColor:'#1c1c1c', border:'1px solid #2a2a2a', padding:'14px 16px' }
const ttip   = { backgroundColor:'#1a1a1a', border:'1px solid #3a3a3a', color:'#eee', fontSize:11 }
const axTick = { fill:'#777', fontSize:10 }
const fmtK   = v => v >= 1000000 ? `${(v/1000000).toFixed(2)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v

const CARRIER_KEYS  = ['express','ground','priority','sameDay','standard','freight','returns','unknown']
const LEGEND_ITEMS  = [
  ['EXPRESS', C.express], ['GROUND',   C.ground],
  ['PRIORITY',C.priority],['SAME DAY', C.sameDay],
  ['STANDARD',C.standard],['FREIGHT',  C.freight],
  ['RETURNS', C.returns], ['UNKNOWN',  C.unknown],
]

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

function KpiCard({ label, sublabel, primary, secondary, isDragging, isOver, dragHandlers }) {
  return (
    <div
      {...dragHandlers}
      style={{
        ...panel,
        display:'flex', flexDirection:'column',
        cursor:'grab',
        opacity: isDragging ? 0.35 : 1,
        outline: (isDragging || isOver) ? '2px solid #00bcd4' : '2px solid transparent',
        transition:'opacity 0.15s, outline 0.1s',
        userSelect:'none',
      }}
    >
      <div style={{ color:'#fff', fontSize:26, fontWeight:700, lineHeight:1.1 }}>{primary}</div>
      {secondary && <div style={{ color:'#ffb74d', fontSize:11, marginTop:2 }}>{secondary}</div>}
      <div style={{ flex:1 }} />
      <div style={{ color:'#80cbc4', fontSize:12, fontWeight:500, lineHeight:1.3, marginTop:6 }}>{label}</div>
      {sublabel && <div style={{ color:'#ffb74d', fontSize:10 }}>{sublabel}</div>}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [country, setCountry] = useState('United States')
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

  const carrierData = d.carriers.map(r => ({
    ...r,
    _total: CARRIER_KEYS.reduce((s, k) => s + (r[k] || 0), 0),
  }))

  return (
    <div style={{ backgroundColor:'#111', minHeight:'100vh', fontFamily:'Inter, system-ui, sans-serif', color:'#fff' }}>

      {/* ── Menu bar ── */}
      <div style={{ backgroundColor:'#161616', borderBottom:'1px solid #2a2a2a', height:40, display:'flex', alignItems:'center', padding:'0 16px', gap:24 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#fff', letterSpacing:'0.02em' }}>
          WarehouseIQ
        </span>
        <span style={{ color:'#555', fontSize:12 }}>|</span>
        <span style={{ fontSize:12, color:'#aaa' }}>Shipping Dashboard</span>

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#666' }}>Country:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={{
                backgroundColor:'#252525', border:'1px solid #3a3a3a', color:'#ddd',
                fontSize:12, padding:'4px 10px', borderRadius:4, cursor:'pointer',
                display:'flex', alignItems:'center', gap:6,
              }}>
                {country}
                <span style={{ color:'#666', fontSize:10 }}>▼</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent style={{ backgroundColor:'#1e1e1e', border:'1px solid #333', minWidth:160 }}>
              {COUNTRIES.map(c => (
                <DropdownMenuItem
                  key={c}
                  onClick={() => setCountry(c)}
                  style={{
                    color: c === country ? '#00bcd4' : '#ccc',
                    fontSize:12, cursor:'pointer',
                    backgroundColor: c === country ? '#1a2a2a' : 'transparent',
                  }}
                >
                  {c}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Dashboard body ── */}
      <div style={{ padding:'12px 14px' }}>

        {/* KPI cards — draggable */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6, marginBottom:6 }}>
          {kpiCards.map((kpi, i) => (
            <KpiCard
              key={kpi.label + kpi.primary}
              {...kpi}
              isDragging={dragIdx === i}
              isOver={(overIdx === i && dragIdx !== i) || pressedIdx === i}
              dragHandlers={{
                draggable: true,
                onMouseDown: () => setPressedIdx(i),
                onMouseUp:   () => setPressedIdx(null),
                onDragStart: e => handleDragStart(e, i),
                onDragOver:  e => handleDragOver(e, i),
                onDrop:      e => handleDrop(e, i),
                onDragEnd:   handleDragEnd,
              }}
            />
          ))}
        </div>

        {/* Section header */}
        <div style={{ fontSize:15, fontWeight:600, margin:'18px 0 12px', paddingBottom:8, borderBottom:'1px solid #2a2a2a' }}>
          Warehouse Operations Charts — {country}
        </div>

        {/* Charts — draggable 2-column grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
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
                <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Orders by Carrier &amp; Type</div>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart layout="vertical" data={carrierData} margin={{ top:0, right:60, bottom:0, left:0 }} barSize={12}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
                        <XAxis type="number" stroke="#444" tick={axTick} tickFormatter={fmtK} />
                        <YAxis type="category" dataKey="carrier" stroke="#444" tick={axTick} width={120} />
                        <Tooltip contentStyle={ttip} formatter={v => v.toLocaleString()} />
                        {CARRIER_KEYS.map((k, ki) => (
                          <Bar key={k} dataKey={k} stackId="a" fill={C[k]} name={k.replace('sameDay','SAME DAY').toUpperCase()}>
                            {ki === CARRIER_KEYS.length - 1 && (
                              <LabelList dataKey="_total" position="right"
                                content={({ x, y, width, height, value }) =>
                                  value > 0
                                    ? <text x={x+width+4} y={y+height/2} fill="#aaa" fontSize={10} dominantBaseline="middle">{value.toLocaleString()}</text>
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
                <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Shipment Count Over Time</div>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={d.time} margin={{ top:10, right:10, bottom:28, left:14 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                        <XAxis dataKey="date" stroke="#444" tick={axTick}
                          label={{ value:'Ship Date', position:'insideBottom', offset:-14, fill:'#555', fontSize:10 }} />
                        <YAxis stroke="#444" tick={axTick} tickFormatter={fmtK}
                          label={{ value:'Count of Orders', angle:-90, position:'insideLeft', offset:10, fill:'#555', fontSize:10 }} />
                        <Tooltip contentStyle={ttip} formatter={v => v.toLocaleString()} />
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
                <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Order Failure Rate</div>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart layout="vertical" data={d.failure} margin={{ left:10, right:20 }} barSize={30}>
                    <XAxis type="number" stroke="#444" tick={axTick}
                      tickFormatter={v => {
                        const total = d.failure[0].delivered + d.failure[0].failed + d.failure[0].canceled
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
                <div style={{ display:'flex', justifyContent:'space-between', color:'#666', fontSize:10, marginTop:2 }}>
                  <span>0%</span><span>% of Orders</span><span>100%</span>
                </div>
                <SwatchLegend items={[['CANCELED',C.canceled],['FAILED',C.failed],['DELIVERED',C.delivered]]} />
              </div>
            )

            if (id === 'status') return (
              <div key={id} style={chartPanelStyle} {...dragProps}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:10 }}>Orders By Status (Failure Rate)</div>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ flex:1 }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={d.status} margin={{ top:4, right:10, bottom:28, left:14 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                        <XAxis dataKey="date" stroke="#444" tick={axTick}
                          label={{ value:'Ship Date', position:'insideBottom', offset:-14, fill:'#555', fontSize:10 }} />
                        <YAxis stroke="#444" tick={axTick} tickFormatter={v => `${v}%`} domain={[0,100]} />
                        <Tooltip contentStyle={ttip} formatter={v => `${v}%`} />
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
