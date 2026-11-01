import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Ellipse, Image as KonvaImage, Layer, Rect, Stage, Transformer, Group, Line, Text } from 'react-konva';
import useImage from 'use-image';
import {
  ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Copy, Download, ImagePlus,
  Layers3, LockKeyhole, Maximize, Move, Plus, Redo2, RotateCcw, Save,
  Settings2, Sofa, Sparkles, Trash2,
  UnlockKeyhole, Upload, Undo2, X, ZoomIn, ZoomOut,
} from 'lucide-react';

const W = 1200;
const H = 675;
const STORAGE_KEY = 'stagecraft-projects-v1';
const PHOTOS_DB_NAME = 'stagecraft-photos';
const PHOTOS_STORE_NAME = 'photos';
const DEFAULT_LIGHTING = { color: '255, 220, 181', intensity: 28 };
const LIGHT_PRESETS = [
  { id: 'warm', name: 'Warm white', color: '255, 220, 181', swatch: '#f3d2a6' },
  { id: 'amber', name: 'Amber', color: '255, 165, 74', swatch: '#e6a354' },
  { id: 'rose', name: 'Rose', color: '236, 151, 166', swatch: '#d99ca7' },
  { id: 'cool', name: 'Cool white', color: '174, 207, 232', swatch: '#a9c3d6' },
];
const CATEGORIES = [
  { id: 'all', label: 'All assets', icon: Layers3 },
  { id: 'background', label: 'Backgrounds', icon: ImagePlus },
  { id: 'seating', label: 'Sofas & seating', icon: Sofa },
  { id: 'decor', label: 'Decor objects', icon: Sparkles },
];

const starterAssets = [
  { id: 'curtain', name: 'Ivory Draped Backdrop', category: 'background', src: '/assets/curtain-stage.png' },
  { id: 's2', name: 'Floral Ceremony Stage', category: 'background', src: '/photos/s2.jpg' },
  { id: 'sofa', name: 'Royal Love Seat', category: 'seating', src: '/assets/sofa-cutout.png' },
  { id: 'arch', name: 'Blush Floral Arch', category: 'decor', src: '/assets/big-flowers-cutout.png' },
  { id: 'flower', name: 'Rose Centrepiece', category: 'decor', src: '/assets/flower-removebg-preview.png' },
  { id: 'pillar', name: 'Golden Floral Pillar', category: 'decor', src: '/assets/pillers-removebg-preview.png' },
  { id: 'lamp', name: 'Crystal Chandelier', category: 'decor', src: '/assets/lamp-cutout.png' },
];

const initialObjects = [
  { id: 'starter-left-pillar', assetId: 'pillar', name: 'Golden Floral Pillar', src: '/assets/pillers-removebg-preview.png', category: 'decor', x: 185, y: 498, width: 277, height: 277, rotation: 0, locked: false },
  { id: 'starter-right-pillar', assetId: 'pillar', name: 'Golden Floral Pillar', src: '/assets/pillers-removebg-preview.png', category: 'decor', x: 1015, y: 498, width: 277, height: 277, rotation: 0, locked: false },
  { id: 'starter-arch', assetId: 'arch', name: 'Blush Floral Arch', src: '/assets/big-flowers-cutout.png', category: 'decor', x: 600, y: 325, width: 638, height: 638, rotation: 0, locked: false },
  { id: 'starter-lamp', assetId: 'lamp', name: 'Crystal Chandelier', src: '/assets/lamp-cutout.png', category: 'decor', x: 600, y: 150, width: 240, height: 240, rotation: 0, locked: false },
  { id: 'starter-sofa', assetId: 'sofa', name: 'Royal Love Seat', src: '/assets/sofa-cutout.png', category: 'seating', x: 600, y: 425, width: 500, height: 500, rotation: 0, locked: false },
  { id: 'starter-flower-left', assetId: 'flower', name: 'Rose Centrepiece', src: '/assets/flower-removebg-preview.png', category: 'decor', x: 335, y: 517, width: 185, height: 185, rotation: -7, locked: false },
  { id: 'starter-flower-right', assetId: 'flower', name: 'Rose Centrepiece', src: '/assets/flower-removebg-preview.png', category: 'decor', x: 865, y: 517, width: 185, height: 185, rotation: 7, locked: false },
];

function readProjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function openPhotosDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('Persistent photo storage is not available in this browser.'));
      return;
    }

    const request = window.indexedDB.open(PHOTOS_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(PHOTOS_STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open photo storage.'));
  });
}

async function readSavedPhotos() {
  const database = await openPhotosDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(PHOTOS_STORE_NAME, 'readonly').objectStore(PHOTOS_STORE_NAME).getAll();
    request.onsuccess = () => { database.close(); resolve(request.result); };
    request.onerror = () => { database.close(); reject(request.error || new Error('Could not read saved photos.')); };
  });
}

async function savePhotos(photos) {
  const database = await openPhotosDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PHOTOS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(PHOTOS_STORE_NAME);
    photos.forEach((photo) => store.put(photo));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Could not save photos.')); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error('Photo storage was interrupted.')); };
  });
}

function useAssetImage(src) {
  const [image] = useImage(src, 'anonymous');
  return image;
}

function coverCrop(image, width, height) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  if (sourceRatio > targetRatio) {
    const cropWidth = image.height * targetRatio;
    return { x: (image.width - cropWidth) / 2, y: 0, width: cropWidth, height: image.height };
  }
  const cropHeight = image.width / targetRatio;
  return { x: 0, y: (image.height - cropHeight) / 2, width: image.width, height: cropHeight };
}

function initialCanvasSize() {
  const { innerWidth, innerHeight } = window;
  if (innerWidth <= 820) return { width: innerWidth, height: innerHeight - 174 };
  const compactPanels = innerWidth <= 1120;
  const compactHeight = innerHeight <= 650;
  const sidePanels = compactPanels ? 442 : 542;
  const topBars = compactHeight ? 54 + 39 : 68 + 49;
  const footer = compactHeight ? 27 : 36;
  return { width: innerWidth - sidePanels, height: innerHeight - topBars - footer };
}

function PlacedImage({ item, selected, mouseRotateMode, onSelect, onChange, onDragStart, registerNode }) {
  const image = useAssetImage(item.src);
  const nodeRef = useCallback((node) => registerNode(item.id, node), [item.id, registerNode]);
  if (!image) return null;
  return (
    <KonvaImage
      ref={nodeRef}
      image={image}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      offsetX={item.width / 2}
      offsetY={item.height / 2}
      rotation={item.rotation}
      draggable={!item.locked && !mouseRotateMode}
      onClick={(event) => { if (mouseRotateMode) event.cancelBubble = true; else onSelect(); }}
      onTap={(event) => { if (mouseRotateMode) event.cancelBubble = true; else onSelect(); }}
      onDragStart={onDragStart}
      onDragEnd={(event) => onChange({ x: event.target.x(), y: event.target.y() })}
      onTransformEnd={(event) => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          x: node.x(), y: node.y(), rotation: node.rotation(),
          width: Math.max(30, item.width * scaleX), height: Math.max(30, item.height * scaleY),
        });
      }}
      opacity={image ? 1 : 0}
      shadowColor="#111111"
      shadowBlur={selected ? 0 : 4}
      shadowOpacity={selected ? 0 : 0.09}
    />
  );
}

function Stagecraft() {
  const [assets, setAssets] = useState(starterAssets);
  const [objects, setObjects] = useState(initialObjects);
  const [background, setBackground] = useState('curtain');
  const [lighting, setLighting] = useState(DEFAULT_LIGHTING);
  const [stageSize, setStageSize] = useState({ width: W, height: H });
  const [projectName, setProjectName] = useState('Amara & James — Reception');
  const [selectedId, setSelectedId] = useState(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [viewSize, setViewSize] = useState(initialCanvasSize);
  const [history, setHistory] = useState([{ objects: initialObjects, background: 'curtain', stageSize: { width: W, height: H }, lighting: DEFAULT_LIGHTING }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [toast, setToast] = useState(null);
  const [previewAsset, setPreviewAsset] = useState(null);
  const [showProjects, setShowProjects] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  const [savedProjects, setSavedProjects] = useState(readProjects);
  const [confirmClear, setConfirmClear] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(() => window.matchMedia('(max-width: 820px)').matches ? 'stage' : 'inventory');
  const [mouseRotateMode, setMouseRotateMode] = useState(false);
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const canvasRef = useRef(null);
  const nodeMap = useRef(new Map());
  const rotationValue = useRef(0);
  const fileInputRef = useRef(null);
  const selected = objects.find((item) => item.id === selectedId) || null;
  const backgroundAsset = assets.find((asset) => asset.id === background);
  const backgroundImage = useAssetImage(backgroundAsset?.src);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    let active = true;
    readSavedPhotos()
      .then((photos) => {
        if (active) setAssets((current) => [...current, ...photos.filter((photo) => !current.some((asset) => asset.id === photo.id))]);
      })
      .catch((error) => {
        if (active) notify(`Could not load saved photos: ${error.message}`, 'error');
      });
    return () => { active = false; };
  }, [notify]);

  const scale = useMemo(() => Math.min((viewSize.width - 64) / stageSize.width, (viewSize.height - 64) / stageSize.height) * zoom, [viewSize, stageSize, zoom]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const measure = () => {
      if (!canvasRef.current) return;
      const bounds = canvasRef.current.getBoundingClientRect();
      setViewSize({ width: bounds.width, height: bounds.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvasRef.current);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const selectedNode = nodeMap.current.get(selectedId);
    if (selectedNode && transformerRef.current) {
      transformerRef.current.nodes([selectedNode]);
      transformerRef.current.getLayer()?.batchDraw();
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedId, objects]);

  useEffect(() => {
    const onKey = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (typing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault(); event.shiftKey ? redo() : undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault(); duplicateSelected();
      } else if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected();
      else if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const commit = useCallback((nextObjects, nextBackground = background, nextStage = stageSize, nextLighting = lighting) => {
    setObjects(nextObjects);
    setBackground(nextBackground);
    setStageSize(nextStage);
    setLighting(nextLighting);
    setHistory((previous) => {
      const base = previous.slice(0, historyIndex + 1);
      const next = [...base, { objects: nextObjects, background: nextBackground, stageSize: nextStage, lighting: nextLighting }].slice(-60);
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [background, stageSize, lighting, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const snapshot = history[nextIndex];
    setHistoryIndex(nextIndex); setObjects(snapshot.objects); setBackground(snapshot.background); setStageSize(snapshot.stageSize); setLighting(snapshot.lighting || DEFAULT_LIGHTING);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const snapshot = history[nextIndex];
    setHistoryIndex(nextIndex); setObjects(snapshot.objects); setBackground(snapshot.background); setStageSize(snapshot.stageSize); setLighting(snapshot.lighting || DEFAULT_LIGHTING);
  }, [history, historyIndex]);

  const registerNode = useCallback((id, node) => {
    if (node) nodeMap.current.set(id, node);
    else nodeMap.current.delete(id);
  }, []);

  const addAsset = useCallback((asset, x = stageSize.width / 2, y = stageSize.height * 0.68) => {
    if (asset.category === 'background') {
      commit(objects, asset.id);
      setSelectedId(null);
      notify(`${asset.name} applied to stage`);
      return;
    }
    const image = new window.Image();
    image.onload = () => {
      const maxWidth = asset.category === 'seating' ? stageSize.width * 0.46 : stageSize.width * 0.27;
      const factor = Math.min(maxWidth / image.naturalWidth, stageSize.height * 0.62 / image.naturalHeight, 1);
      const width = Math.max(30, image.naturalWidth * factor);
      const height = Math.max(30, image.naturalHeight * factor);
      const object = { id: crypto.randomUUID(), assetId: asset.id, name: asset.name, src: asset.src, category: asset.category, x, y, width, height, rotation: 0, locked: false };
      commit([...objects, object]); setSelectedId(object.id);
    };
    image.onerror = () => notify(`Could not load ${asset.name}`, 'error');
    image.src = asset.src;
  }, [commit, notify, objects, stageSize]);

  const setAsBackground = (asset) => {
    commit(objects, asset.id);
    setSelectedId(null);
    setPreviewAsset(null);
    notify(`${asset.name} set as stage background`);
  };

  const updateSelected = (patch) => {
    if (!selected) return;
    const next = objects.map((item) => item.id === selected.id ? { ...item, ...patch } : item);
    commit(next);
  };

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    commit(objects.filter((item) => item.id !== selectedId)); setSelectedId(null);
  }, [selectedId, commit, objects]);

  const duplicateSelected = useCallback(() => {
    const item = objects.find((entry) => entry.id === selectedId);
    if (!item) return;
    const copy = { ...item, id: crypto.randomUUID(), x: item.x + 36, y: item.y + 28, name: `${item.name} copy`, locked: false };
    commit([...objects, copy]); setSelectedId(copy.id);
  }, [selectedId, objects, commit]);

  const changeLayer = (direction) => {
    if (!selected) return;
    const index = objects.findIndex((item) => item.id === selected.id);
    const destination = Math.max(0, Math.min(objects.length - 1, index + direction));
    if (index === destination) return;
    const next = [...objects]; [next[index], next[destination]] = [next[destination], next[index]]; commit(next);
  };

  const uploadFiles = async (files) => {
    const accepted = [...files].filter((file) => file.type.startsWith('image/'));
    const rejected = files.length - accepted.length;
    if (!accepted.length) { notify('Choose a browser-compatible image file', 'error'); return; }
    try {
      const additions = await Promise.all(accepted.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error(`Could not read ${file.name} as an image.`));
            return;
          }
          const stem = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
          const lower = stem.toLowerCase();
          const category = /sofa|seat|couch|chair/.test(lower) ? 'seating' : /backdrop|background|curtain|drape/.test(lower) ? 'background' : 'decor';
          resolve({ id: crypto.randomUUID(), name: stem || 'Stage Decoration', category, src: reader.result, uploaded: true });
        };
        reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}.`));
        reader.readAsDataURL(file);
      })));
      await savePhotos(additions);
      setAssets((current) => [...current, ...additions]);
      if (rejected) notify(`${additions.length} photo${additions.length === 1 ? '' : 's'} saved; ${rejected} unsupported file${rejected === 1 ? '' : 's'} skipped`);
      else notify(`${additions.length} photo${additions.length === 1 ? '' : 's'} saved to Photos`);
    } catch (error) {
      notify(`Could not save uploaded photos: ${error.message}`, 'error');
    }
  };

  const renameAsset = async (asset, name) => {
    const updated = { ...asset, name };
    try {
      if (asset.uploaded) await savePhotos([updated]);
      setAssets((current) => current.map((item) => item.id === asset.id ? updated : item));
    } catch (error) {
      notify(`Could not save photo changes: ${error.message}`, 'error');
    }
  };

  const saveProject = () => {
    try {
      const projects = readProjects();
      const entry = { id: 'current', name: projectName, objects, background, stageSize, lighting, assets, updatedAt: new Date().toISOString() };
      const next = [entry, ...projects.filter((item) => item.id !== 'current')];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedProjects(next); notify('Project saved in this browser');
    } catch {
      notify('Browser storage is full. Remove large uploaded images and try again.', 'error');
    }
  };

  const loadProject = (entry) => {
    setProjectName(entry.name);
    setAssets((current) => {
      const projectAssets = entry.assets || starterAssets;
      return [...projectAssets, ...current.filter((asset) => asset.uploaded && !projectAssets.some((savedAsset) => savedAsset.id === asset.id))];
    });
    setObjects(entry.objects || []);
    setBackground(entry.background || null); setStageSize(entry.stageSize || { width: W, height: H });
    setLighting(entry.lighting || DEFAULT_LIGHTING);
    setHistory([{ objects: entry.objects || [], background: entry.background || null, stageSize: entry.stageSize || { width: W, height: H }, lighting: entry.lighting || DEFAULT_LIGHTING }]);
    setHistoryIndex(0); setSelectedId(null); setShowProjects(false); notify('Project opened');
  };

  const exportPng = () => {
    if (!stageRef.current) return;
    try {
      setSelectedId(null);
      window.setTimeout(() => {
        try {
          const data = stageRef.current.toDataURL({ pixelRatio: 3, mimeType: 'image/png' });
          const link = document.createElement('a');
          link.download = `${projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-stage.png`;
          link.href = data; link.click(); notify('High-resolution PNG exported');
        } catch { notify('Export failed. Try removing any externally loaded image and export again.', 'error'); }
      }, 80);
    } catch { notify('Export failed', 'error'); }
  };

  const clearStage = () => {
    commit([], null); setSelectedId(null); setConfirmClear(false); notify('Stage composition cleared');
  };

  const fitStage = () => {
    const next = Math.min((viewSize.width - 64) / stageSize.width, (viewSize.height - 64) / stageSize.height);
    setFitScale(next); setZoom(1);
  };

  const onDrop = (event) => {
    event.preventDefault();
    const id = event.dataTransfer.getData('application/stagecraft-asset');
    const asset = assets.find((entry) => entry.id === id);
    if (!asset || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    addAsset(asset, (event.clientX - bounds.left - (bounds.width - stageSize.width * scale) / 2) / scale, (event.clientY - bounds.top - (bounds.height - stageSize.height * scale) / 2) / scale);
  };

  const filteredAssets = assets.filter((asset) => (category === 'all' || asset.category === category) && asset.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Stagecraft home"><span className="brand-mark"><span /></span><span>stagecraft</span></a>
        <div className="top-divider" />
        <div className="project-title-wrap"><span className="eyebrow">PROJECT</span><input aria-label="Project name" className="project-title" value={projectName} onChange={(event) => setProjectName(event.target.value)} /></div>
        <div className="top-actions">
          <div className="history-actions">
            <button className="icon-button" title="Undo" aria-label="Undo" disabled={historyIndex === 0} onClick={undo}><Undo2 size={17} /></button>
            <button className="icon-button" title="Redo" aria-label="Redo" disabled={historyIndex >= history.length - 1} onClick={redo}><Redo2 size={17} /></button>
          </div>
          <span className="top-action-divider" />
          <button className="icon-button zoom-icon" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom((value) => Math.max(0.5, +(value - 0.1).toFixed(1)))}><ZoomOut size={16} /></button>
          <button className="zoom-label" aria-label="Reset zoom" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button className="icon-button zoom-icon" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((value) => Math.min(1.6, +(value + 0.1).toFixed(1)))}><ZoomIn size={16} /></button>
          <button className="fit-button" title="Fit stage to workspace" onClick={fitStage}><Maximize size={15} /><span>Fit</span></button>
          <button className="save-button" onClick={saveProject}><Save size={15} /><span>Save</span></button>
          <button className="export-button" onClick={exportPng}><Download size={15} /><span>Export</span></button>
          <button className="icon-button projects-button" title="Open saved projects" onClick={() => { setSavedProjects(readProjects()); setShowProjects(true); }}><ChevronDown size={16} /></button>
        </div>
      </header>

      <main className="editor-layout">
        <aside className={`inventory-panel ${mobilePanel === 'inventory' ? 'mobile-active' : ''}`}>
          <div className="panel-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h1>Inventory</h1></div><span className="count-pill">{assets.length}</span></div>
          <div className="inventory-search"><input placeholder="Search assets" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search inventory" /><span className="search-shortcut">/</span></div>
          <nav className="category-nav" aria-label="Inventory categories">
            {CATEGORIES.map(({ id, label, icon: Icon }) => <button key={id} className={`category-item ${category === id ? 'active' : ''}`} onClick={() => setCategory(id)}><Icon size={16} strokeWidth={1.7} /><span>{label}</span>{id === 'all' && <span className="category-count">{assets.length}</span>}</button>)}
          </nav>
          <div className="inventory-section-label"><span>PHOTOS</span><button className="text-icon-button" onClick={() => fileInputRef.current?.click()} title="Upload images"><Plus size={16} /></button></div>
          <div className="asset-list">
            {filteredAssets.map((asset) => <AssetRow key={asset.id} asset={asset} onAdd={() => addAsset(asset)} onPreview={() => setPreviewAsset(asset)} onRename={(name) => renameAsset(asset, name)} />)}
            {!filteredAssets.length && <div className="empty-inventory"><ImagePlus size={23} /><strong>{assets.length ? 'No matching assets' : 'Your inventory is empty'}</strong><span>Upload transparent PNGs or other image files to begin.</span></div>}
          </div>
          <button className="upload-button" onClick={() => fileInputRef.current?.click()}><Upload size={16} /><span>Upload images</span><span className="upload-shortcut">PNG · JPG · WEBP</span></button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => uploadFiles(event.target.files)} />
          <div className="sidebar-foot"><span className="status-dot" /> Local workspace <span className="foot-separator">·</span> No cloud sync</div>
        </aside>

        <section className="workspace">
          <div className="workspace-toolbar">
            <div className="breadcrumb"><span>Projects</span><ChevronRight size={14} /><strong>{projectName}</strong></div>
            <div className="canvas-toolbar"><span className="canvas-status"><span className="status-dot" /> All changes saved locally</span><span className="toolbar-separator" /><button className="tool-icon" title="Stage settings" onClick={() => setShowStageSettings(true)}><Settings2 size={16} /></button><button className="tool-icon" title="Clear composition" onClick={() => setConfirmClear(true)}><Trash2 size={16} /></button></div>
          </div>
          <div className="mobile-tabs"><button className={mobilePanel === 'inventory' ? 'active' : ''} onClick={() => setMobilePanel('inventory')}>Inventory</button><button className={mobilePanel === 'stage' ? 'active' : ''} onClick={() => setMobilePanel('stage')}>Stage</button><button className={mobilePanel === 'properties' ? 'active' : ''} onClick={() => setMobilePanel('properties')}>Properties</button></div>
          <div className={`canvas-area ${mouseRotateMode ? 'mouse-rotate-mode' : ''}`} ref={canvasRef} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <div className="canvas-mat" style={{ width: stageSize.width * scale, height: stageSize.height * scale }}>
              <Stage ref={stageRef} width={stageSize.width * scale} height={stageSize.height * scale} scaleX={scale} scaleY={scale} onMouseDown={(event) => { if (!mouseRotateMode && event.target === event.target.getStage()) setSelectedId(null); }} onTouchStart={(event) => { if (event.target === event.target.getStage()) setSelectedId(null); }}>
                <Layer>
                  <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill="#f8f7f4" listening={false} />
                  {backgroundImage && <KonvaImage image={backgroundImage} x={0} y={0} width={stageSize.width} height={stageSize.height} crop={coverCrop(backgroundImage, stageSize.width, stageSize.height)} listening={false} />}
                  {!backgroundImage && <Group listening={false}><Line points={[0, stageSize.height * 0.83, stageSize.width, stageSize.height * 0.83]} stroke="#e8e5df" strokeWidth={1} /><Line points={[stageSize.width * 0.1, stageSize.height * 0.83, 0, stageSize.height]} stroke="#eeece7" strokeWidth={1} /><Line points={[stageSize.width * 0.9, stageSize.height * 0.83, stageSize.width, stageSize.height]} stroke="#eeece7" strokeWidth={1} /></Group>}
                  {lighting.intensity > 0 && <>
                    <Rect x={0} y={0} width={stageSize.width} height={stageSize.height} fill={`rgba(${lighting.color}, ${lighting.intensity / 100 * 0.12})`} listening={false} />
                    {[0.22, 0.5, 0.78].map((position) => <Ellipse key={position} x={stageSize.width * position} y={stageSize.height * 0.13} radiusX={stageSize.width * 0.23} radiusY={stageSize.height * 0.74} fillRadialGradientStartPoint={{ x: 0, y: 0 }} fillRadialGradientStartRadius={0} fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientEndRadius={stageSize.height * 0.74} fillRadialGradientColorStops={[0, `rgba(${lighting.color}, ${lighting.intensity / 100 * 0.10})`, 0.58, `rgba(${lighting.color}, ${lighting.intensity / 100 * 0.04})`, 1, `rgba(${lighting.color}, 0)`]} listening={false} />)}
                  </>}
                  {objects.map((item) => <PlacedImage key={item.id} item={item} selected={selectedId === item.id} mouseRotateMode={mouseRotateMode} onSelect={() => setSelectedId(item.id)} onChange={(patch) => commit(objects.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry))} onDragStart={() => setSelectedId(item.id)} registerNode={registerNode} />)}
                  {selected && mouseRotateMode && !selected.locked && (() => {
                    const orbit = Math.hypot(selected.width, selected.height) / 2 + 34;
                    const radians = (selected.rotation * Math.PI) / 180;
                    const handleX = selected.x + Math.sin(radians) * orbit;
                    const handleY = selected.y - Math.cos(radians) * orbit;
                    const innerX = selected.x + Math.sin(radians) * (orbit - 17);
                    const innerY = selected.y - Math.cos(radians) * (orbit - 17);
                    return <Group listening>
                      <Line points={[innerX, innerY, handleX, handleY]} stroke="#242421" strokeWidth={1.5} listening={false} />
                      <Circle x={handleX} y={handleY} radius={13} fill="#f3d2a6" stroke="#242421" strokeWidth={1.5} draggable onMouseEnter={(event) => { event.target.getStage().container().style.cursor = 'grab'; }} onMouseLeave={(event) => { event.target.getStage().container().style.cursor = 'crosshair'; }} onDragStart={(event) => { rotationValue.current = selected.rotation; event.target.getStage().container().style.cursor = 'grabbing'; }} onDragMove={(event) => {
                        const angle = Math.round(Math.atan2(event.target.x() - selected.x, selected.y - event.target.y()) * 180 / Math.PI);
                        rotationValue.current = angle;
                        setObjects((current) => current.map((item) => item.id === selected.id ? { ...item, rotation: angle } : item));
                      }} onDragEnd={() => {
                        const next = objects.map((item) => item.id === selected.id ? { ...item, rotation: rotationValue.current } : item);
                        commit(next);
                      }} />
                      <Text x={handleX - 5} y={handleY - 6} text="↻" fontFamily="Arial" fontSize={12} fill="#242421" listening={false} />
                    </Group>;
                  })()}
                  <Transformer ref={transformerRef} rotateEnabled={!selected?.locked && !mouseRotateMode} enabledAnchors={selected?.locked || mouseRotateMode ? [] : ['top-left', 'top-right', 'bottom-left', 'bottom-right']} keepRatio borderStroke="#161616" borderStrokeWidth={1} anchorStroke="#161616" anchorFill="#fff" anchorSize={10} rotateAnchorOffset={44} rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]} boundBoxFunc={(oldBox, newBox) => (newBox.width < 28 || newBox.height < 28 ? oldBox : newBox)} />
                  {!backgroundImage && objects.length === 0 && <Group listening={false}><Text x={stageSize.width / 2 - 125} y={stageSize.height * 0.46} width={250} align="center" text="YOUR STAGE, YOUR VISION" fontFamily="Arial" fontSize={11} letterSpacing={1.7} fill="#93908a" /><Text x={stageSize.width / 2 - 160} y={stageSize.height * 0.46 + 23} width={320} align="center" text="Drag a backdrop or decoration onto the canvas" fontFamily="Arial" fontSize={14} fill="#74716c" /></Group>}
                </Layer>
              </Stage>
            </div>
            <div className="canvas-caption"><span><Move size={13} /> Front elevation</span><span>{stageSize.width} × {stageSize.height} px</span></div>
          </div>
          <div className="workspace-footer"><span><span className="footer-key">⌘</span> + drag to move around</span><span>Drag an asset from your inventory to place it</span><button onClick={fitStage}><Maximize size={13} /> Fit stage</button></div>
        </section>

        <aside className={`properties-panel ${mobilePanel === 'properties' ? 'mobile-active' : ''}`}>
          <div className="properties-heading"><div><span className="eyebrow">DESIGN CONTROLS</span><h2>Properties</h2></div><button className="tool-icon" title="Stage settings" onClick={() => setShowStageSettings(true)}><Settings2 size={16} /></button></div>
          {selected ? <>
            <div className="selected-object"><div className="selection-thumb"><AssetThumbnail src={selected.src} /></div><div className="selected-object-meta"><span className="eyebrow">SELECTED OBJECT</span><input value={selected.name} aria-label="Object name" onChange={(event) => updateSelected({ name: event.target.value })} /></div><button className="tool-icon" title="Delete object" onClick={deleteSelected}><Trash2 size={15} /></button></div>
            <div className="property-section"><div className="property-section-heading"><span>TRANSFORM</span><RotateCcw size={13} /></div><div className="field-grid"><NumberField label="X position" value={Math.round(selected.x)} onChange={(value) => updateSelected({ x: value })} unit="px" /><NumberField label="Y position" value={Math.round(selected.y)} onChange={(value) => updateSelected({ y: value })} unit="px" /><NumberField label="Width" value={Math.round(selected.width)} onChange={(value) => updateSelected({ width: Math.max(20, value) })} unit="px" /><NumberField label="Height" value={Math.round(selected.height)} onChange={(value) => updateSelected({ height: Math.max(20, value) })} unit="px" /><NumberField label="Rotation" value={Math.round(selected.rotation)} onChange={(value) => updateSelected({ rotation: value })} unit="°" /></div><label className="object-rotation-slider"><span>Mouse rotation</span><input aria-label="Mouse rotation" type="range" min="-180" max="180" step="1" value={Math.max(-180, Math.min(180, Math.round(selected.rotation)))} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} /><span className="rotation-range-labels"><span>-180°</span><span>0°</span><span>180°</span></span></label></div>
            <div className="property-section"><div className="property-section-heading"><span>LAYER ORDER</span><Layers3 size={14} /></div><div className="layer-controls"><button title="Send to back" onClick={() => changeLayer(-objects.length)}><ArrowDownToLine size={15} /></button><button title="Send backward" onClick={() => changeLayer(-1)}><ArrowDown size={15} /></button><span>Layer {objects.findIndex((item) => item.id === selected.id) + 1} of {objects.length}</span><button title="Bring forward" onClick={() => changeLayer(1)}><ArrowUp size={15} /></button><button title="Bring to front" onClick={() => changeLayer(objects.length)}><ArrowUpToLine size={15} /></button></div></div>
            <div className="property-section object-actions"><button title="Show a larger rotation handle on the selected object" onClick={() => setMouseRotateMode((active) => !active)} className={mouseRotateMode ? 'rotate-mode-active' : ''}><RotateCcw size={15} />{mouseRotateMode ? 'Rotation handle active' : 'Rotate with mouse'}</button>{mouseRotateMode && <span className="rotation-hint">Drag the highlighted handle above the object.</span>}<button onClick={duplicateSelected}><Copy size={15} /> Duplicate</button><button onClick={() => updateSelected({ locked: !selected.locked })}>{selected.locked ? <UnlockKeyhole size={15} /> : <LockKeyhole size={15} />}{selected.locked ? 'Unlock object' : 'Lock object'}</button></div>
          </> : <>
            <div className="no-selection"><div className="no-selection-icon"><Move size={19} /></div><strong>No object selected</strong><span>Select an object on the stage to edit its properties, or add a decoration from your inventory.</span></div>
            <div className="property-section stage-summary"><div className="property-section-heading"><span>STAGE</span><button className="small-text-button" onClick={() => setShowStageSettings(true)}>Edit</button></div><div className="summary-row"><span>Canvas size</span><strong>{stageSize.width} × {stageSize.height}</strong></div><div className="summary-row"><span>Background</span><strong>{backgroundAsset?.name || 'Warm white'}</strong></div><div className="summary-row"><span>Placed objects</span><strong>{objects.length}</strong></div></div>
            <div className="property-section quick-actions"><div className="property-section-heading"><span>QUICK ACTIONS</span></div><button onClick={undo} disabled={historyIndex === 0}><Undo2 size={15} /> Undo last change</button><button onClick={duplicateSelected} disabled={!selected}><Copy size={15} /> Duplicate selection</button></div>
          </>}
          <div className="property-section lighting-section"><div className="property-section-heading"><span>STAGE LIGHTING</span><Sparkles size={14} /></div><span className="lighting-label">Color temperature</span><div className="light-swatches">{LIGHT_PRESETS.map((preset) => <button key={preset.id} type="button" aria-label={`${preset.name} lighting`} title={preset.name} className={lighting.color === preset.color ? 'active' : ''} style={{ '--swatch': preset.swatch }} onClick={() => commit(objects, background, stageSize, { ...lighting, color: preset.color })}><span /></button>)}</div><label className="lighting-intensity"><span>Intensity</span><strong>{lighting.intensity}%</strong><input aria-label="Lighting intensity" type="range" min="0" max="70" value={lighting.intensity} style={{ '--range-progress': `${lighting.intensity / 70 * 100}%` }} onChange={(event) => setLighting((current) => ({ ...current, intensity: Number(event.target.value) }))} onPointerUp={() => commit(objects, background, stageSize, lighting)} onKeyUp={() => commit(objects, background, stageSize, lighting)} /></label></div>
          <div className="properties-bottom"><CircleHelp size={14} /><span>Changes update the stage instantly</span><button title="Clear stage" onClick={() => setConfirmClear(true)}><Trash2 size={14} /></button></div>
        </aside>
      </main>

      {toast && <div className={`toast ${toast.type}`}><span className="toast-icon">{toast.type === 'error' ? <X size={15} /> : <Check size={15} />}</span>{toast.message}<button onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}
      {showStageSettings && <Modal title="Stage settings" onClose={() => setShowStageSettings(false)}><p className="modal-copy">Set the proportions for your front-view composition.</p><div className="modal-fields"><NumberField label="Width" value={stageSize.width} onChange={(width) => commit(objects, background, { ...stageSize, width: Math.max(480, width) })} unit="px" /><NumberField label="Height" value={stageSize.height} onChange={(height) => commit(objects, background, { ...stageSize, height: Math.max(320, height) })} unit="px" /></div><div className="preset-row"><span>PRESETS</span><button onClick={() => commit(objects, background, { width: 1200, height: 675 })}>16:9</button><button onClick={() => commit(objects, background, { width: 1200, height: 800 })}>3:2</button><button onClick={() => commit(objects, background, { width: 1000, height: 1000 })}>1:1</button></div><button className="modal-primary" onClick={() => setShowStageSettings(false)}><Check size={15} /> Done</button></Modal>}
      {confirmClear && <Modal title="Clear this composition?" onClose={() => setConfirmClear(false)}><p className="modal-copy">All placed objects and the selected backdrop will be removed. You can undo this action.</p><div className="modal-actions"><button className="modal-secondary" onClick={() => setConfirmClear(false)}>Cancel</button><button className="modal-danger" onClick={clearStage}><Trash2 size={15} /> Clear stage</button></div></Modal>}
      {showProjects && <Modal title="Saved projects" onClose={() => setShowProjects(false)}><p className="modal-copy">Projects saved in this browser on this device.</p>{savedProjects.length ? savedProjects.map((entry) => <button className="saved-project" key={entry.id} onClick={() => loadProject(entry)}><span className="saved-project-icon"><Layers3 size={17} /></span><span><strong>{entry.name}</strong><small>{new Date(entry.updatedAt).toLocaleString()} · {entry.objects.length} objects</small></span><ChevronRight size={16} /></button>) : <div className="empty-saved">No saved projects yet. Use Save to keep this stage on your device.</div>}</Modal>}
      {previewAsset && <Modal title="Asset preview" onClose={() => setPreviewAsset(null)} wide><div className="preview-image"><img src={previewAsset.src} alt={previewAsset.name} /></div><div className="preview-meta"><div><span className="eyebrow">{CATEGORIES.find((item) => item.id === previewAsset.category)?.label.toUpperCase()}</span><strong>{previewAsset.name}</strong></div><div className="preview-actions"><button className="modal-secondary" onClick={() => setAsBackground(previewAsset)}><ImagePlus size={15} /> Set as background</button><button className="modal-primary" onClick={() => { addAsset(previewAsset); setPreviewAsset(null); }}><Plus size={15} /> Add to stage</button></div></div></Modal>}
    </div>
  );
}

function AssetRow({ asset, onAdd, onPreview, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(asset.name);
  const categoryLabel = CATEGORIES.find((item) => item.id === asset.category)?.label || 'Decoration';
  const finishRename = () => { const name = draft.trim(); if (name) onRename(name); else setDraft(asset.name); setEditing(false); };
  return <div className="asset-row" draggable onDragStart={(event) => event.dataTransfer.setData('application/stagecraft-asset', asset.id)} onDoubleClick={() => { setDraft(asset.name); setEditing(true); }}>
    <button className="asset-thumbnail" title="Preview asset" onClick={onPreview}><AssetThumbnail src={asset.src} /></button>
    <div className="asset-info">{editing ? <input autoFocus value={draft} aria-label="Rename asset" onChange={(event) => setDraft(event.target.value)} onBlur={finishRename} onKeyDown={(event) => event.key === 'Enter' && finishRename()} /> : <button className="asset-name" title="Double-click to rename" onClick={() => { setDraft(asset.name); setEditing(true); }}>{asset.name}</button>}<span>{categoryLabel}</span></div>
    <button className="asset-add" title="Add to stage" onClick={onAdd}><Plus size={15} /></button>
  </div>;
}

function AssetThumbnail({ src }) {
  const image = useAssetImage(src);
  return image ? <img src={src} alt="" /> : <span className="thumbnail-loading"><ImagePlus size={16} /></span>;
}

function NumberField({ label, value, onChange, unit }) {
  return <label className="number-field"><span>{label}</span><div><input type="number" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} /><span>{unit}</span></div></label>;
}

function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="tool-icon" onClick={onClose} aria-label="Close"><X size={17} /></button></div>{children}</section></div>;
}

export default Stagecraft;