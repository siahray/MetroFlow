import React, { useState } from 'react';
import { 
  Activity, AlertTriangle, ArrowLeft, Battery, Camera, CheckCircle, 
  ChevronRight, Clock, Droplets, FileText, ImageIcon, Map as MapIcon, 
  MapPin, MessageSquare, Printer, Radio, Share2, ShieldAlert, Siren, 
  Thermometer, Truck, User, Video, Shield, Navigation, Wind, Settings,
  AlertOctagon, Check
} from 'lucide-react';

// --- Placeholder Components ---
const MapPlaceholder = ({ text = "Map Area Placeholder", height = "h-64", children }) => (
  <div className={`w-full ${height} bg-slate-100 border border-slate-200 rounded-xl relative overflow-hidden flex items-center justify-center group`}>
    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4=')] opacity-50"></div>
    <div className="text-slate-400 flex flex-col items-center z-10 group-hover:scale-105 transition-transform duration-300">
      <MapIcon className="w-8 h-8 mb-2 opacity-50" />
      <span className="text-sm font-medium tracking-wide uppercase opacity-70">{text}</span>
    </div>
    {children}
  </div>
);

const PhotoPlaceholder = ({ text = "Photo Placeholder", height = "h-48", children }) => (
  <div className={`w-full ${height} bg-slate-800 rounded-xl relative overflow-hidden flex items-center justify-center group`}>
    <div className="text-slate-500 flex flex-col items-center z-10 group-hover:scale-105 transition-transform duration-300">
      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
      <span className="text-xs font-medium uppercase opacity-70">{text}</span>
    </div>
    {children}
  </div>
);


// --- View 1: Dispatch Radar (Report Verification Detail) ---
const DispatchRadarView = () => (
  <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
    {/* Header */}
    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
      <div className="flex items-center space-x-4">
        <button className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Queue
        </button>
        <div className="h-4 w-px bg-slate-300"></div>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-bold text-slate-800">Flood Report #FR-0248</h2>
          <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Pending</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-xs text-slate-500">Queue: 8 pending reviews</span>
        <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-right shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Urgency Score</div>
          <div className="text-lg font-extrabold text-rose-600 leading-none">8.4<span className="text-sm text-slate-400 font-medium">/10</span></div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Submission Params */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center"><User className="w-3.5 h-3.5 mr-1.5" /> Submission Parameters</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Submitted by</div>
              <div className="font-semibold text-sm text-slate-800">Dale Ramos</div>
              <div className="text-[10px] text-slate-400">Verified Citizen ID</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Date & Time</div>
              <div className="font-semibold text-sm text-slate-800">Oct 22, 2026 11:42 AM</div>
              <div className="text-[10px] text-slate-400">14 minutes ago</div>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-800">Brgy. San Pedro</div>
              <div className="text-[11px] text-slate-500 font-mono">14.5995° N, 121.0223° E</div>
            </div>
            <span className="bg-sky-100 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-200">Sector Delta</span>
          </div>
        </div>

        {/* Citizen Description */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center"><MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Citizen Field Description</h3>
           <p className="text-sm font-medium text-slate-800 mb-2">"Flooding in residential area, 1-2 ft water level."</p>
           <p className="text-xs text-slate-600 italic leading-relaxed border-l-2 border-slate-200 pl-3">
             Light passenger vehicles cannot pass. Water is actively rising from the south canal overflow. 3 elderly citizens waiting at second floor porch.
           </p>
        </div>

        {/* Evidence Tags */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attached Telemetry & Evidence</h3>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded bg-sky-600 text-white text-xs font-medium shadow-sm"><Camera className="w-3 h-3 mr-1.5" /> Photo (1)</span>
            <span className="inline-flex items-center px-3 py-1 rounded bg-white border border-slate-200 text-slate-600 text-xs font-medium"><MapPin className="w-3 h-3 mr-1.5" /> GPS (Accurate ±4m)</span>
            <span className="inline-flex items-center px-3 py-1 rounded bg-slate-100 border border-slate-200 text-slate-400 text-xs font-medium"><Video className="w-3 h-3 mr-1.5" /> CCTV (0 Available)</span>
          </div>
          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 text-xs font-medium w-full">
            <Droplets className="w-3.5 h-3.5 mr-2 text-sky-500" /> IoT Depth Sensor #D-12 reading 0.48m nearby.
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="lg:col-span-7 space-y-6 flex flex-col">
        {/* Photo Verification */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center"><Camera className="w-4 h-4 mr-2 text-sky-600" /> Citizen Photo Verification</h3>
            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100 flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> EXIF Verified</span>
          </div>
          <PhotoPlaceholder text="Ground Recon Photo" height="h-56">
            <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded-lg text-white">
              <div className="text-sm font-bold">Estimated Depth: 1.5 ft (45 cm)</div>
              <div className="text-[10px] text-slate-300">Calf to knee-deep submersion detected by AI</div>
            </div>
            <button className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 backdrop-blur p-2 rounded-lg text-white transition-colors border border-white/20">
              <ImageIcon className="w-4 h-4" />
            </button>
          </PhotoPlaceholder>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="bg-slate-50 p-2 rounded border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Camera</div>
              <div className="text-xs font-semibold text-slate-700">iPhone 14 Pro</div>
            </div>
            <div className="bg-slate-50 p-2 rounded border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">Orientation</div>
              <div className="text-xs font-semibold text-slate-700">North-West</div>
            </div>
            <div className="bg-sky-50 p-2 rounded border border-sky-100">
              <div className="text-[9px] text-sky-600 uppercase font-bold mb-0.5">AI Confidence</div>
              <div className="text-xs font-bold text-sky-800">98.2% Authentic</div>
            </div>
          </div>
        </div>

        {/* Map Geo-Anchor */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center"><MapPin className="w-4 h-4 mr-2 text-rose-600" /> Dispatch Geo-Anchor</h3>
            <span className="text-[10px] text-slate-500 font-medium">Nearest Unit: RU-03 (4.2 km)</span>
          </div>
          <MapPlaceholder text="Incident Location Map" height="flex-1 min-h-[200px]">
            {/* Fake Map Elements */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="w-12 h-12 bg-rose-500/20 rounded-full animate-ping absolute"></div>
              <div className="w-4 h-4 bg-rose-600 border-2 border-white rounded-full relative z-10 shadow-md"></div>
              <div className="mt-2 bg-white/90 backdrop-blur px-2 py-1 rounded shadow-sm text-[10px] font-bold text-slate-800 border border-slate-200">#FR-0248 Pin</div>
            </div>
          </MapPlaceholder>
        </div>
      </div>
    </div>

    {/* Bottom Actions Bar */}
    <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between sticky bottom-4 z-20">
      <div className="flex space-x-3">
        <button className="flex items-center px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
          <FileText className="w-4 h-4 mr-2" /> Add Note
        </button>
        <button className="flex items-center px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
          Escalate to PNP / BFP
        </button>
      </div>
      <div className="flex space-x-3">
        <button className="flex items-center px-6 py-2.5 text-sm font-bold text-rose-600 bg-white border-2 border-rose-200 hover:border-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
          Reject Report
        </button>
        <button className="flex items-center px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 rounded-lg transition-colors">
          <CheckCircle className="w-4 h-4 mr-2" /> Approve & Dispatch
        </button>
      </div>
    </div>
  </div>
);

// --- View 2: Sensors & Water Level (Flood/Road Closure Editor) ---
const SensorsWaterLevelView = () => (
  <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4 animate-in fade-in duration-300">
    {/* Map Toolbar */}
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between flex-shrink-0">
      <div className="flex space-x-2">
        <button className="bg-navy-900 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center shadow-sm">
          <MapIcon className="w-4 h-4 mr-2" /> Flood Polygon
        </button>
        <button className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-1.5 rounded-lg text-sm font-medium flex items-center transition-colors">
          <AlertOctagon className="w-4 h-4 mr-2" /> Road Closure
        </button>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-2"></div> Telemetry Sync: Active
        </div>
        <button className="text-sm font-medium text-slate-500 hover:text-slate-800">Reset Canvas</button>
      </div>
    </div>

    <div className="flex-1 flex gap-4 min-h-0">
      {/* Interactive Map Area */}
      <div className="flex-1 relative flex flex-col">
        <MapPlaceholder text="Interactive Edit Canvas" height="h-full">
          {/* Mock Drawn Polygon */}
          <div className="absolute top-1/3 left-1/3 w-64 h-48 border-[3px] border-sky-500 bg-sky-500/20 rounded-lg transform rotate-3 flex items-center justify-center backdrop-blur-[1px]">
            <div className="bg-white/90 px-3 py-2 rounded shadow-sm text-center border border-slate-200 transform -rotate-3">
              <div className="text-xs font-bold text-slate-800">1.4m Depth Est.</div>
              <div className="text-[10px] text-slate-500">Submerged Area</div>
            </div>
            {/* Mock Nodes */}
            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-sky-500 rounded-sm"></div>
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-sky-500 rounded-sm"></div>
            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-sky-500 rounded-sm"></div>
            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-sky-500 rounded-sm"></div>
          </div>
          
          {/* Mock Road Closure Line */}
          <div className="absolute top-1/2 left-1/4 w-48 h-1.5 bg-rose-500 transform rotate-12 flex items-center justify-center shadow-[0_0_8px_rgba(244,63,94,0.6)]">
             <div className="bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm transform -rotate-12 absolute -top-4">Rizal Ave. Closed</div>
          </div>
        </MapPlaceholder>

        {/* Floating Tool Palette */}
        <div className="absolute top-4 left-4 bg-white border border-slate-200 rounded-lg shadow-md flex flex-col p-1 space-y-1">
          <button className="p-2 bg-slate-100 rounded text-slate-800"><Navigation className="w-4 h-4" /></button>
          <button className="p-2 hover:bg-slate-50 rounded text-slate-500 transition-colors"><MapPin className="w-4 h-4" /></button>
          <button className="p-2 hover:bg-slate-50 rounded text-slate-500 transition-colors"><CheckCircle className="w-4 h-4" /></button>
        </div>

        {/* Bottom Context Bar */}
        <div className="absolute bottom-4 inset-x-4 bg-white/95 backdrop-blur border border-slate-200 p-3 rounded-xl shadow-lg flex justify-between items-center text-xs">
          <div className="flex items-center space-x-4">
            <span className="flex items-center font-medium text-slate-700"><div className="w-3 h-3 bg-sky-500 mr-2 rounded-sm"></div> Polygon: San Pedro Perimeter</span>
            <span className="flex items-center font-medium text-slate-700"><div className="w-3 h-1 bg-rose-500 mr-2 rounded-sm"></div> Closure: Rizal Ave Segment 4</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-500 font-mono">
            <span>Area: 142,850 m²</span>
            <span>14.5995° N, 121.0223° E</span>
          </div>
        </div>
      </div>

      {/* Right Control Sidebar */}
      <div className="w-80 flex-shrink-0 flex flex-col space-y-4 overflow-y-auto">
        {/* Flood Polygon Form */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center"><MapIcon className="w-4 h-4 mr-2 text-sky-600" /> Flood Polygon</h3>
            <span className="text-[10px] font-mono text-sky-600 bg-sky-50 px-2 py-0.5 rounded">ID: FP-2026-08</span>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Polygon Identifier / Name</label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30" defaultValue="San Pedro Flood Area" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Obstruction Severity Level</label>
            <select className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-slate-800 appearance-none font-medium">
              <option>High (Impassable to all civilian vehicles)</option>
              <option>Moderate (Impassable to light vehicles)</option>
              <option>Low (Caution, passable)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
               <div className="text-[10px] text-slate-500 font-semibold mb-0.5">Avg. Depth</div>
               <div className="text-sm font-bold text-sky-700">1.4 meters</div>
             </div>
             <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
               <div className="text-[10px] text-slate-500 font-semibold mb-0.5">Est. Residents</div>
               <div className="text-sm font-bold text-slate-700">1,240 citizens</div>
             </div>
          </div>

          <div>
             <label className="block text-xs font-semibold text-slate-500 mb-2">Map Overlay Color Swatch</label>
             <div className="flex space-x-2">
               <div className="w-6 h-6 rounded-full bg-sky-800 ring-2 ring-offset-2 ring-sky-500 cursor-pointer"></div>
               <div className="w-6 h-6 rounded-full bg-sky-400 cursor-pointer"></div>
               <div className="w-6 h-6 rounded-full bg-amber-500 cursor-pointer"></div>
               <div className="w-6 h-6 rounded-full bg-rose-500 cursor-pointer"></div>
               <div className="w-6 h-6 rounded-full bg-rose-900 cursor-pointer"></div>
             </div>
          </div>

          <button className="w-full py-2 bg-navy-900 hover:bg-navy-800 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center">
            Save Polygon
          </button>
        </div>

        {/* Road Closure Form */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center"><AlertOctagon className="w-4 h-4 mr-2 text-rose-600" /> Road Closure</h3>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">Active Barricade</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Target Road Segment</label>
            <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none" defaultValue="Rizal Avenue (San Pedro - Bridge)" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Closure Reason</label>
            <div className="relative">
              <input type="text" className="w-full bg-white border border-rose-200 text-rose-700 font-medium rounded-lg py-2 pl-3 pr-9 text-sm focus:outline-none" defaultValue="Flooding / Heavy Submersion" />
              <AlertTriangle className="w-4 h-4 absolute right-3 top-2.5 text-rose-500" />
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div>
              <div className="text-xs font-semibold text-slate-800">Physical Barrier Deployed</div>
              <div className="text-[10px] text-slate-500">PNP / LGU Traffic Marshal on Site</div>
            </div>
            {/* Toggle switch mock */}
            <div className="w-10 h-6 bg-emerald-500 rounded-full relative cursor-pointer shadow-inner">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
            </div>
          </div>

           <div className="bg-sky-50 border border-sky-100 p-3 rounded-lg">
             <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700 mb-1">Suggested Reroute</div>
             <p className="text-xs text-sky-900">Traffic diverted via J.P. Rizal Highway north bound lanes. Estimated delay: +14 mins.</p>
           </div>
        </div>
      </div>
    </div>
  </div>
);

// --- View 3: Rescue Units & Fleet (Rescue Tracking) ---
const RescueTrackingView = () => (
  <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
    {/* Header */}
    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
      <div className="flex items-center space-x-4">
         <button className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Dispatch
        </button>
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-slate-800">Rescue Unit RU-03</h2>
            <span className="bg-sky-100 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center border border-sky-200"><div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse mr-1.5"></div> EN ROUTE</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Live telemetry, real-time depth hydro-routing & biometric beacon link</p>
        </div>
      </div>
      <div className="flex space-x-3">
         <button className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors">
          <Radio className="w-4 h-4 mr-2 text-sky-600" /> Comm Link (CH-4)
        </button>
        <button className="flex items-center px-4 py-2 bg-navy-900 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-navy-800 transition-colors">
          <Wifi className="w-4 h-4 mr-2" /> Broadcast Ping
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column - Unit Details */}
      <div className="lg:col-span-4 flex flex-col space-y-4">
        {/* Unit Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Truck className="w-24 h-24" />
          </div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-sky-900 rounded-lg flex items-center justify-center text-white shadow-inner">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Amphibious Swiftwater</div>
                <div className="font-bold text-slate-800">Unit RU-03</div>
              </div>
            </div>
            <div className="bg-slate-100 text-slate-600 font-mono text-xs px-2 py-1 rounded">ID: #LCT-0321</div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4 relative z-10">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
               <div className="text-[10px] text-slate-500 uppercase mb-1">Lead Pilot</div>
               <div className="text-sm font-bold text-slate-800 flex items-center"><User className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> Carlo Reyes</div>
               <div className="text-[10px] text-slate-500 mt-0.5">Paramedic Cert. IV</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
               <div className="text-[10px] text-slate-500 uppercase mb-1">Live Payload</div>
               <div className="text-sm font-bold text-slate-800 flex items-center"><div className="w-3 h-3 bg-emerald-500 rounded mr-1.5"></div> 2 / 6 Capacity</div>
               <div className="text-[10px] text-sky-600 font-medium mt-0.5">4 slots available</div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 relative z-10">
             <div className="flex items-center space-x-2">
               <Activity className="w-4 h-4 text-sky-500" />
               <div>
                 <div className="text-[10px] text-slate-500">Water Speed</div>
                 <div className="text-xs font-bold text-slate-800">14.8 knots</div>
               </div>
             </div>
             <div className="flex items-center space-x-2 text-right">
               <div>
                 <div className="text-[10px] text-slate-500">Aux Battery</div>
                 <div className="text-xs font-bold text-slate-800">88% (4.2 hrs)</div>
               </div>
               <Battery className="w-5 h-5 text-emerald-500 transform rotate-90" />
             </div>
          </div>
        </div>

        {/* Distress Target Card */}
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-rose-50/30 flex justify-between items-center">
             <div className="flex items-center space-x-2">
               <div className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></div>
               <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Distress Target Beacon</span>
             </div>
             <span className="text-[10px] font-mono text-slate-500">Ticket #FR-0248</span>
          </div>
          <div className="p-4 space-y-4 flex-1">
            <div>
              <h3 className="text-base font-bold text-slate-800">Brgy. San Pedro</h3>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center"><MapPin className="w-3 h-3 mr-1" /> 14.5995° N, 121.0223° E • Sector Delta</p>
            </div>
            
            <div className="bg-rose-50 p-3 rounded-lg border border-rose-100">
              <div className="text-xs font-bold text-rose-800 flex items-center mb-1"><AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> 6 Civilians Trapped on Rooftop</div>
              <p className="text-[11px] text-rose-700 leading-tight">Includes 1 infant and 1 senior citizen with limited mobility. Water level approx 1.8m and rising.</p>
            </div>

            <PhotoPlaceholder height="h-28" text="">
               {/* Mock Image Content */}
               <div className="absolute inset-0 bg-slate-800 opacity-60 mix-blend-multiply"></div>
               <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                 <div className="w-8 h-8 rounded-full bg-rose-500/30 border border-rose-500 flex items-center justify-center shadow-lg">
                   <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                 </div>
               </div>
               <div className="absolute bottom-2 left-2 text-[9px] text-white/80 font-mono bg-black/40 px-1.5 py-0.5 rounded backdrop-blur">Field Recon Photo (11:52 AM)</div>
               <div className="absolute bottom-2 right-2 text-[9px] text-white font-bold bg-sky-600 px-1.5 py-0.5 rounded shadow">Depth: 1.8m</div>
            </PhotoPlaceholder>
          </div>
        </div>
      </div>

      {/* Right Column - Map & Timelines */}
      <div className="lg:col-span-8 space-y-4 flex flex-col">
        {/* Map Area */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative h-[340px]">
           <div className="absolute top-6 left-6 z-10 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-md border border-slate-200 flex items-center space-x-4">
             <div className="flex items-center space-x-2 border-r border-slate-200 pr-4">
               <CheckCircle className="w-4 h-4 text-emerald-500" />
               <div>
                 <div className="text-[9px] text-slate-500 uppercase font-bold">Optimal Clearance</div>
                 <div className="text-xs font-bold text-slate-800">Rizal Ave North Arterial</div>
               </div>
             </div>
             <div>
               <div className="text-[9px] text-slate-500 uppercase font-bold">Channel Depth</div>
               <div className="text-xs font-bold text-sky-600">0.9m - 1.4m Safe</div>
             </div>
           </div>

           <div className="absolute top-6 right-6 z-10 flex flex-col space-y-1 bg-white shadow-sm border border-slate-200 rounded-lg p-1">
             <button className="p-1.5 hover:bg-slate-100 rounded text-slate-600">+</button>
             <div className="h-px bg-slate-100 mx-1"></div>
             <button className="p-1.5 hover:bg-slate-100 rounded text-slate-600">-</button>
             <div className="h-px bg-slate-100 mx-1"></div>
             <button className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><Navigation className="w-3.5 h-3.5" /></button>
           </div>

           <MapPlaceholder text="" height="h-full">
             {/* Mock Route Graphics */}
             <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 340">
                {/* Flood Zone Overlay */}
                <path d="M 200,200 Q 300,100 450,250 T 650,150 L 700,200 L 600,300 Z" fill="#bae6fd" opacity="0.4" />
                <path d="M 400,150 Q 500,50 600,120 T 700,80 L 750,150 L 550,250 Z" fill="#fecdd3" opacity="0.3" />
                
                {/* Route Line */}
                <path d="M 150,280 L 250,280 L 350,220 L 450,120 L 550,100 L 650,120 L 700,180" fill="none" stroke="#0ea5e9" strokeWidth="4" strokeDasharray="8 4" className="animate-[dash_2s_linear_infinite]" />
                
                {/* Nodes */}
                <circle cx="150" cy="280" r="14" fill="#0f172a" />
                <path d="M145,280 h10 M150,275 v10" stroke="white" strokeWidth="2"/> {/* Depot Icon Mock */}
                <text x="150" y="310" fontSize="10" fontWeight="bold" fill="#334155" textAnchor="middle">Depot Delta</text>

                <circle cx="700" cy="180" r="14" fill="#e11d48" />
                <circle cx="700" cy="180" r="6" fill="#fff" />
                <text x="700" y="210" fontSize="10" fontWeight="bold" fill="#e11d48" textAnchor="middle">Target</text>
             </svg>
             {/* Moving Unit Blip */}
             <div className="absolute top-[120px] left-[450px] transform -translate-x-1/2 -translate-y-1/2">
                <div className="bg-navy-900 text-white px-2 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center space-x-1">
                  <Truck className="w-3 h-3" /> <span>RU-03</span>
                </div>
             </div>
           </MapPlaceholder>
        </div>

        {/* ETA Metrics Row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center"><Clock className="w-3 h-3 mr-1" /> Estimated Arrival (ETA)</div>
            <div className="text-2xl font-bold text-slate-900">12<span className="text-sm font-medium text-slate-500 ml-1">min</span></div>
            <div className="text-[10px] text-slate-400 mt-1">Arriving ~ 12:13 PM</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center"><Navigation className="w-3 h-3 mr-1" /> Remaining Distance</div>
            <div className="text-2xl font-bold text-slate-900">4.2<span className="text-sm font-medium text-slate-500 ml-1">km</span></div>
            <div className="text-[10px] text-slate-400 mt-1">Total corridor: 6.8 km</div>
          </div>
          <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 shadow-sm">
            <div className="text-[10px] text-sky-700 font-bold uppercase mb-1 flex items-center"><Droplets className="w-3 h-3 mr-1" /> Flood Depth En Route</div>
            <div className="text-2xl font-bold text-sky-700">1.2<span className="text-sm font-medium opacity-70 ml-1">m</span></div>
            <div className="text-[10px] text-sky-600 mt-1">Within safe draft limit</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center"><Home className="w-3 h-3 mr-1 text-emerald-500" /> Assigned Safe Haven</div>
            <div className="text-sm font-bold text-slate-800 truncate">EC West High</div>
            <div className="text-[10px] text-slate-400 mt-1">Capacity: 450 (180 free)</div>
          </div>
        </div>

        {/* Mission Timeline & Actions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between flex-1">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-800">Mission Milestone Timeline</h3>
            <span className="text-[10px] text-slate-400 font-medium flex items-center"><Activity className="w-3 h-3 mr-1" /> Telemetry Synced Just Now</span>
          </div>
          
          <div className="relative px-6 mb-6">
            {/* Track */}
            <div className="absolute top-1/2 left-8 right-8 h-1 bg-slate-100 -translate-y-1/2"></div>
            <div className="absolute top-1/2 left-8 w-[60%] h-1 bg-sky-500 -translate-y-1/2"></div>
            
            <div className="flex justify-between relative z-10">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-md mb-2"><Check className="w-4 h-4" /></div>
                <div className="text-xs font-bold text-slate-800">Dispatched</div>
                <div className="text-[10px] text-slate-400">11:58 AM</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-white border-2 border-sky-500 text-sky-600 flex items-center justify-center shadow-md mb-2 ring-4 ring-sky-50"><Truck className="w-4 h-4" /></div>
                <div className="text-xs font-bold text-sky-700">En Route</div>
                <div className="text-[10px] text-sky-600">12:01 PM</div>
              </div>
              <div className="flex flex-col items-center opacity-50">
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-300 text-slate-400 flex items-center justify-center mb-2"><MapPin className="w-4 h-4" /></div>
                <div className="text-xs font-bold text-slate-600">On Site</div>
                <div className="text-[10px] text-slate-400">Est. 12:13 PM</div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-2">
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">Reroute via High Ground</button>
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">Escalate to Air Assets</button>
            <div className="flex-1"></div>
            <button className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center">
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[9px] mr-2">SOS</span> Signal Immediate Support Unit
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --- View 4: Civic Broadcasts (Published Hazard Alert) ---
const CivicBroadcastsView = () => (
  <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto">
     <div className="flex items-center justify-between border-b border-slate-200 pb-4">
      <div className="flex items-center space-x-4">
         <button className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Alerts
        </button>
        <div className="h-4 w-px bg-slate-300"></div>
        <div className="text-xs text-slate-500 font-mono">ALERT ID: ADV-2026-0427-09</div>
      </div>
      <div className="flex space-x-3">
         <span className="flex items-center px-3 py-1.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-full border border-rose-100">
          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse mr-2"></div> Live Public Broadcast
        </span>
         <button className="flex items-center px-4 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50">
          <Share2 className="w-3.5 h-3.5 mr-2" /> Share Bulletin
        </button>
        <button className="flex items-center px-4 py-1.5 bg-navy-900 text-white text-xs font-bold rounded-lg shadow-sm">
           Revise Advisory
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column - Document */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Red Header Bar */}
        <div className="bg-rose-600 p-5 flex justify-between items-center text-white">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-8 h-8" />
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase opacity-80">Official Civic Protocol</div>
              <div className="text-xl font-bold tracking-tight">FLOOD WARNING</div>
            </div>
          </div>
          <div className="bg-black/20 backdrop-blur px-3 py-1 rounded-full border border-white/20 text-xs font-bold flex items-center">
            <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> HIGH RISK
          </div>
        </div>

        <div className="p-8 space-y-8 flex-1">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">Metro City — Flood Advisory</h1>
            <div className="flex items-center space-x-4 mb-4">
              <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded">Level 3 Response</span>
              <span className="text-xs text-slate-500 flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> Issued: Oct 22, 2026 11:45 AM</span>
              <span className="text-xs text-slate-500 flex items-center"><Shield className="w-3.5 h-3.5 mr-1" /> By: MDRRMC Command Bureau</span>
            </div>
            <p className="text-base text-slate-700 leading-relaxed font-medium">
              Moderate to heavy rains may cause rapid flooding in low-lying residential sectors and transport arteries. Citizens are strongly urged to stay alert, avoid unnecessary travel to flood-prone areas, and prepare personal evacuation bags.
            </p>
          </div>

          <div>
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Areas Affected</h3>
               <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">3 Priority Zones</span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
               <div className="p-3 border border-rose-200 bg-rose-50/50 rounded-lg">
                 <div className="font-bold text-sm text-slate-800 flex items-center mb-1"><MapPin className="w-3.5 h-3.5 mr-1 text-rose-500" /> Rizal Avenue</div>
                 <div className="text-[10px] text-slate-500 mb-2 leading-tight">San Pedro to Central Bridge</div>
                 <div className="text-[10px] font-bold text-rose-700 flex items-center"><div className="w-1.5 h-1.5 bg-rose-600 rounded-full mr-1.5"></div> Severe Inundation</div>
               </div>
               <div className="p-3 border border-amber-200 bg-amber-50/50 rounded-lg">
                 <div className="font-bold text-sm text-slate-800 flex items-center mb-1"><MapPin className="w-3.5 h-3.5 mr-1 text-amber-500" /> Brgy. San Pedro</div>
                 <div className="text-[10px] text-slate-500 mb-2 leading-tight">Residential lowlands</div>
                 <div className="text-[10px] font-bold text-amber-700 flex items-center"><div className="w-1.5 h-1.5 bg-amber-600 rounded-full mr-1.5"></div> 1.5 - 2.0 ft Water Level</div>
               </div>
               <div className="p-3 border border-sky-200 bg-sky-50/50 rounded-lg">
                 <div className="font-bold text-sm text-slate-800 flex items-center mb-1"><MapPin className="w-3.5 h-3.5 mr-1 text-sky-500" /> Brgy. Malaya</div>
                 <div className="text-[10px] text-slate-500 mb-2 leading-tight">Riverbank district</div>
                 <div className="text-[10px] font-bold text-sky-700 flex items-center"><div className="w-1.5 h-1.5 bg-sky-600 rounded-full mr-1.5"></div> Rapid Creek Overflow</div>
               </div>
             </div>
          </div>

          <div>
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Ground Telemetry & Imagery Verification</h3>
             <div className="grid grid-cols-2 gap-4">
                <PhotoPlaceholder height="h-32" text="">
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                   <div className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur">FR-0248 Ground Photo</div>
                </PhotoPlaceholder>
                <PhotoPlaceholder height="h-32" text="">
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                   <div className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur">CCTV Station 04 Malaya</div>
                </PhotoPlaceholder>
             </div>
          </div>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-200 flex space-x-3">
          <button className="flex-1 py-2.5 bg-navy-900 hover:bg-navy-800 text-white text-sm font-bold rounded-lg transition-colors shadow-sm">View Affected Roads & Areas</button>
          <button className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-bold rounded-lg transition-colors flex items-center justify-center"><Printer className="w-4 h-4 mr-2" /> Print PDF Bulletin</button>
        </div>
      </div>

      {/* Right Column - Map & Channels */}
      <div className="lg:col-span-5 space-y-6 flex flex-col">
        {/* Map Impact */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold text-slate-800 flex items-center"><MapIcon className="w-4 h-4 mr-2 text-sky-600" /> Sector Impact Geospatial</h3>
             <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">2 Roads Closed</span>
           </div>
           <MapPlaceholder height="h-48" text="Impact Radius Map">
              <div className="absolute top-2 left-2 right-2 bg-white/95 backdrop-blur text-xs font-bold text-slate-700 px-2 py-1.5 rounded border border-slate-200 shadow-sm flex items-center">
                <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div> Rizal Ave Segment: 100% Inundated
              </div>
              <div className="absolute bottom-2 left-2 right-2 bg-sky-50 text-[10px] font-bold text-sky-800 px-2 py-1.5 rounded border border-sky-200 shadow-sm flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1.5 text-sky-600" /> Safe Detour Active: Bypass Route 4B
              </div>
           </MapPlaceholder>
        </div>

        {/* Telemetry */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold text-slate-800">Active Sensor Telemetry</h3>
             <span className="text-[10px] font-medium text-sky-600">Auto-sync 30s</span>
           </div>
           <div className="space-y-3">
             <div className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
               <div className="flex items-center text-sm font-medium text-slate-700"><div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div> Marikina River</div>
               <div className="flex items-center space-x-3"><span className="font-bold text-slate-800">4.8 m</span><span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded w-16 text-center">Critical</span></div>
             </div>
             <div className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
               <div className="flex items-center text-sm font-medium text-slate-700"><div className="w-2 h-2 rounded-full bg-sky-500 mr-2"></div> San Pedro Creek</div>
               <div className="flex items-center space-x-3"><span className="font-bold text-slate-800">3.2 m</span><span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded w-16 text-center">High</span></div>
             </div>
             <div className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
               <div className="flex items-center text-sm font-medium text-slate-700"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div> Tullahan River</div>
               <div className="flex items-center space-x-3"><span className="font-bold text-slate-800">2.1 m</span><span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded w-16 text-center">Normal</span></div>
             </div>
           </div>
        </div>

        {/* Broadcast Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold text-slate-800">Broadcast Channels</h3>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
           </div>
           <div className="space-y-3">
             <div className="flex items-center justify-between p-3 border border-sky-100 bg-sky-50/30 rounded-lg">
               <div className="flex items-center space-x-3">
                 <div className="w-8 h-8 bg-sky-100 text-sky-600 rounded flex items-center justify-center"><Radio className="w-4 h-4" /></div>
                 <div>
                   <div className="text-xs font-bold text-slate-800">Emergency Cell Broadcast (CB)</div>
                   <div className="text-[10px] text-slate-500">Geo-targeted radius: 4.5 km</div>
                 </div>
               </div>
               <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-1 rounded">Dispatched</span>
             </div>
             <div className="flex items-center justify-between p-3 border border-indigo-100 bg-indigo-50/30 rounded-lg">
               <div className="flex items-center space-x-3">
                 <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center"><MessageSquare className="w-4 h-4" /></div>
                 <div>
                   <div className="text-xs font-bold text-slate-800">Citizen SMS Gateway</div>
                   <div className="text-[10px] text-slate-500">14,820 Residents Notified</div>
                 </div>
               </div>
               <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded">100% Sent</span>
             </div>
             <div className="flex items-center justify-between p-3 border border-rose-100 bg-rose-50/30 rounded-lg">
               <div className="flex items-center space-x-3">
                 <div className="w-8 h-8 bg-rose-100 text-rose-600 rounded flex items-center justify-center"><Siren className="w-4 h-4" /></div>
                 <div>
                   <div className="text-xs font-bold text-slate-800">Community Siren Arrays</div>
                   <div className="text-[10px] text-slate-500">Zone 1 & 4 Sirens Active</div>
                 </div>
               </div>
               <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-1 rounded flex items-center"><div className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-pulse mr-1.5"></div> Wailing Sound</span>
             </div>
           </div>
        </div>

      </div>
    </div>
  </div>
);

// --- Main App Shell ---
export default function App() {
  const [activeTab, setActiveTab] = useState('radar');

  const navItems = [
    { id: 'radar', label: 'Dispatch Radar', icon: Activity },
    { id: 'sensors', label: 'Sensors & Water Level', icon: Droplets },
    { id: 'rescue', label: 'Rescue Units & Fleet', icon: Truck },
    { id: 'evac', label: 'Evacuation Centers', icon: Home },
    { id: 'broadcasts', label: 'Civic Broadcasts', icon: Radio },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800 selection:bg-sky-200">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-20">
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="w-8 h-8 bg-navy-900 rounded-lg flex items-center justify-center text-white mr-3 shadow-md shadow-navy-900/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <div>
            <div className="text-sm font-extrabold text-navy-900 tracking-tight leading-tight">MetroFlow</div>
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">LGU Operations</div>
          </div>
        </div>

        {/* Status Pill */}
        <div className="p-4">
          <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 flex items-center shadow-sm">
            <div className="w-2.5 h-2.5 bg-rose-600 rounded-full animate-pulse mr-2.5 shadow-[0_0_8px_rgba(225,29,72,0.6)]"></div>
            <span className="text-xs font-bold text-rose-800">Status: Level 2 Alert</span>
          </div>
        </div>

        {/* Nav Menu */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                  isActive 
                    ? 'bg-navy-900 text-white font-semibold shadow-md shadow-navy-900/10' 
                    : 'text-slate-600 hover:bg-slate-100 font-medium'
                }`}
              >
                <Icon className={`w-4 h-4 mr-3 ${isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom Badge */}
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex justify-between items-start">
               <div>
                 <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">MDRRMC Unit</div>
                 <div className="text-xs font-bold text-navy-900">HQ Sector Delta</div>
               </div>
               <Shield className="w-4 h-4 text-sky-600 opacity-80" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-inner">
               <MapIcon className="w-4 h-4 text-sky-600" />
            </div>
            <div>
               <h1 className="text-sm font-bold text-slate-800">MetroFlow LGU Dispatch</h1>
               <div className="text-[10px] text-slate-500 font-medium tracking-wide">MDRRMC Operations Portal</div>
            </div>
          </div>

          <div className="flex items-center space-x-5">
            <div className="flex items-center space-x-3">
              <span className="flex items-center bg-sky-50 text-sky-700 text-xs font-bold px-3 py-1.5 rounded-full border border-sky-100 shadow-sm">
                <Thermometer className="w-3.5 h-3.5 mr-1.5" /> 28°C Rain Advisory
              </span>
              <span className="flex items-center bg-rose-50 text-rose-700 text-xs font-bold px-3 py-1.5 rounded-full border border-rose-100 shadow-sm">
                <Siren className="w-3.5 h-3.5 mr-1.5" /> Active SOS: 14
              </span>
            </div>
            
            <div className="w-px h-6 bg-slate-200"></div>
            
            <div className="flex items-center space-x-3 cursor-pointer group">
              <div className="text-right">
                <div className="text-sm font-bold text-slate-800 group-hover:text-sky-600 transition-colors">Maria Santos</div>
                <div className="text-[10px] text-slate-500 font-medium">Lead Dispatch Officer</div>
              </div>
              <div className="w-9 h-9 bg-navy-900 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-transparent group-hover:ring-sky-200 transition-all">
                MS
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6 md:p-8 bg-slate-50">
          {activeTab === 'radar' && <DispatchRadarView />}
          {activeTab === 'sensors' && <SensorsWaterLevelView />}
          {activeTab === 'rescue' && <RescueTrackingView />}
          {activeTab === 'broadcasts' && <CivicBroadcastsView />}
          {activeTab === 'evac' && (
             <div className="h-full flex items-center justify-center text-slate-400 flex-col animate-in fade-in">
                <Home className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Evacuation Centers module pending deployment.</p>
             </div>
          )}
        </main>
      </div>
    </div>
  );
}