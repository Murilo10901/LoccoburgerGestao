import './lib/legacyBrowserPolyfills.js'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BarChart3,
  Bike,
  Boxes,
  ChefHat,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  Home,
  Menu,
  Package,
  ReceiptText,
  ShoppingBag,
  Utensils,
  UserCog,
  Users,
} from 'lucide-react'
import App from './App.jsx'
import './styles.css'
import './admin-improvements.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App
      icons={{
        BarChart3,
        Bike,
        Boxes,
        ChefHat,
        ClipboardList,
        CreditCard,
        DollarSign,
        FileSpreadsheet,
        Home,
        Menu,
        Package,
        ReceiptText,
        ShoppingBag,
        Utensils,
        UserCog,
        Users,
      }}
      hooks={{ useEffect, useMemo, useRef, useState }}
    />
  </React.StrictMode>,
)
