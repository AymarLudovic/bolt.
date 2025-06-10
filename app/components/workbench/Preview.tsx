import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { PortDropdown } from './PortDropdown';
import { ScreenshotSelector } from './ScreenshotSelector';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { ExpoQrModal } from '~/components/workbench/ExpoQrModal';
// --- AJOUT ---
import { selectedTemplateNameAtom } from '~/lib/stores/workbench'; // Ajustez le chemin si nécessaire

type ResizeSide = 'left' | 'right' | null;

interface WindowSize {
  name: string;
  width: number;
  height: number;
  icon: string;
  hasFrame?: boolean;
  frameType?: 'mobile' | 'tablet' | 'laptop' | 'desktop';
}

const WINDOW_SIZES: WindowSize[] = [
  { name: 'iPhone SE', width: 375, height: 667, icon: 'i-ph:device-mobile', hasFrame: true, frameType: 'mobile' },
  { name: 'iPhone 12/13', width: 390, height: 844, icon: 'i-ph:device-mobile', hasFrame: true, frameType: 'mobile' },
  { name: 'iPhone 12/13 Pro Max', width: 428, height: 926, icon: 'i-ph:device-mobile', hasFrame: true, frameType: 'mobile' },
  { name: 'iPad Mini', width: 768, height: 1024, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'iPad Air', width: 820, height: 1180, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'iPad Pro 11"', width: 834, height: 1194, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'Small Laptop', width: 1280, height: 800, icon: 'i-ph:laptop', hasFrame: true, frameType: 'laptop' },
  { name: 'Laptop', width: 1366, height: 768, icon: 'i-ph:laptop', hasFrame: true, frameType: 'laptop' },
  { name: 'Large Laptop', width: 1440, height: 900, icon: 'i-ph:laptop', hasFrame: true, frameType: 'laptop' },
  { name: 'Desktop', width: 1920, height: 1080, icon: 'i-ph:monitor', hasFrame: true, frameType: 'desktop' },
  { name: '4K Display', width: 3840, height: 2160, icon: 'i-ph:monitor', hasFrame: true, frameType: 'desktop' },
];

export const Preview = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasSelectedPreview = useRef(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [displayPath, setDisplayPath] = useState('/');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeviceModeOn, setIsDeviceModeOn] = useState(false);
  const [widthPercent, setWidthPercent] = useState<number>(37.5);
  const [currentWidth, setCurrentWidth] = useState<number>(0);

  const resizingState = useRef({
    isResizing: false,
    side: null as ResizeSide,
    startX: 0,
    startWidthPercent: 37.5,
    windowWidth: window.innerWidth,
    pointerId: null as number | null,
  });
  const SCALING_FACTOR = 1;
  const [isWindowSizeDropdownOpen, setIsWindowSizeDropdownOpen] = useState(false);
  const [selectedWindowSize, setSelectedWindowSize] = useState<WindowSize>(WINDOW_SIZES[0]);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showDeviceFrame, setShowDeviceFrame] = useState(true);
  const [showDeviceFrameInPreview, setShowDeviceFrameInPreview] = useState(false);
  const expoUrl = useStore(expoUrlAtom);
  const [isExpoQrModalOpen, setIsExpoQrModalOpen] = useState(false);

  const currentSelectedTemplate = useStore(selectedTemplateNameAtom);
  const isExpoTemplate = currentSelectedTemplate === 'Expo App';

  useEffect(() => {
    if (!activePreview) {
      setIframeUrl(undefined);
      setDisplayPath('/');
      return;
    }
    const { baseUrl } = activePreview;
    setIframeUrl(baseUrl);
    setDisplayPath('/');
  }, [activePreview]);

  const findMinPortIndex = useCallback(
    (minIndex: number, preview: { port: number }, index: number, array: { port: number }[]) => {
      return preview.port < array[minIndex].port ? index : minIndex;
    },
    [],
  );

  useEffect(() => {
    if (previews.length > 1 && !hasSelectedPreview.current) {
      const minPortIndex = previews.reduce(findMinPortIndex, 0);
      setActivePreviewIndex(minPortIndex);
    }
  }, [previews, findMinPortIndex]);

  const reloadPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const toggleFullscreen = async () => {
    if (!isFullscreen && containerRef.current) {
      await containerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleDeviceMode = () => setIsDeviceModeOn((prev) => !prev);

  const startResizing = (e: React.PointerEvent, side: ResizeSide) => {
    if (!isDeviceModeOn) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    resizingState.current = {
      isResizing: true,
      side,
      startX: e.clientX,
      startWidthPercent: widthPercent,
      windowWidth: window.innerWidth,
      pointerId: e.pointerId,
    };
  };

  const GripIcon = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', pointerEvents: 'none' }}>
      <div style={{ color: 'var(--bolt-elements-textSecondary, rgba(0,0,0,0.5))', fontSize: '10px', lineHeight: '5px', userSelect: 'none', marginLeft: '1px' }}>
        ••• •••
      </div>
    </div>
  );

  const ResizeHandle = ({ side }: { side: ResizeSide }) => {
    if (!side) return null;
    return (
      <div
        className={`resize-handle-${side}`}
        onPointerDown={(e) => startResizing(e, side)}
        style={{
          position: 'absolute', top: 0,
          ...(side === 'left' ? { left: 0, marginLeft: '-7px' } : { right: 0, marginRight: '-7px' }),
          width: '15px', height: '100%', cursor: 'ew-resize',
          background: 'var(--bolt-elements-background-depth-3, rgba(0,0,0,.15))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s', userSelect: 'none', touchAction: 'none', zIndex: 10,
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-4, rgba(0,0,0,.3))')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-3, rgba(0,0,0,.15))')}
        title="Drag to resize width"
      >
        <GripIcon />
      </div>
    );
  };

  useEffect(() => {
    if (!isDeviceModeOn) return;
    const handlePointerMove = (e: PointerEvent) => {
      const state = resizingState.current;
      if (!state.isResizing || e.pointerId !== state.pointerId) return;
      const dx = e.clientX - state.startX;
      const dxPercent = (dx / state.windowWidth) * 100 * SCALING_FACTOR;
      let newWidthPercent = state.startWidthPercent;
      if (state.side === 'right') newWidthPercent = state.startWidthPercent + dxPercent;
      else if (state.side === 'left') newWidthPercent = state.startWidthPercent - dxPercent;
      newWidthPercent = Math.max(10, Math.min(newWidthPercent, 90));
      setWidthPercent(newWidthPercent);
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const newWidth = Math.round((containerWidth * newWidthPercent) / 100);
        setCurrentWidth(newWidth);
        const previewContainer = containerRef.current.querySelector('div[style*="width"]');
        if (previewContainer) (previewContainer as HTMLElement).style.width = `${newWidthPercent}%`;
      }
    };
    const handlePointerUp = (e: PointerEvent) => {
      const state = resizingState.current;
      if (!state.isResizing || e.pointerId !== state.pointerId) return;
      const handles = document.querySelectorAll('.resize-handle-left, .resize-handle-right');
      handles.forEach((handle) => {
        if ((handle as HTMLElement).hasPointerCapture?.(e.pointerId)) {
          (handle as HTMLElement).releasePointerCapture(e.pointerId);
        }
      });
      resizingState.current = { ...resizingState.current, isResizing: false, side: null, pointerId: null };
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    function cleanupResizeListeners() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
      if (resizingState.current.pointerId !== null) {
        const handles = document.querySelectorAll('.resize-handle-left, .resize-handle-right');
        handles.forEach((handle) => {
          if ((handle as HTMLElement).hasPointerCapture?.(resizingState.current.pointerId!)) {
            (handle as HTMLElement).releasePointerCapture(resizingState.current.pointerId!);
          }
        });
        resizingState.current = { ...resizingState.current, isResizing: false, side: null, pointerId: null };
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    }
    // eslint-disable-next-line consistent-return
    return cleanupResizeListeners;
  }, [isDeviceModeOn, SCALING_FACTOR, widthPercent]);

  useEffect(() => {
    const handleWindowResize = () => {
      resizingState.current.windowWidth = window.innerWidth;
      if (containerRef.current && isDeviceModeOn) {
        const containerWidth = containerRef.current.clientWidth;
        setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
      }
    };
    window.addEventListener('resize', handleWindowResize);
    if (containerRef.current && isDeviceModeOn) {
      const containerWidth = containerRef.current.clientWidth;
      setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
    }
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isDeviceModeOn, widthPercent]);

  useEffect(() => {
    if (containerRef.current && isDeviceModeOn) {
      const containerWidth = containerRef.current.clientWidth;
      setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
    }
  }, [isDeviceModeOn, widthPercent]);

  const getFrameColor = useCallback(() => {
    const isDarkMode = document.documentElement.classList.contains('dark') ||
                       document.documentElement.getAttribute('data-theme') === 'dark' ||
                       window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDarkMode ? '#555' : '#111';
  }, []);

  const openInNewWindow = (size: WindowSize) => {
    if (activePreview?.baseUrl) {
      const match = activePreview.baseUrl.match(/^https?:\/\/([^.]+)\.local-credentialless\.webcontainer-api\.io/);
      if (match) {
        const previewId = match[1];
        let previewUrl = `/webcontainer/preview/${previewId}`;
        if(displayPath && displayPath !== '/') {
            previewUrl += displayPath.startsWith('/') ? displayPath : `/${displayPath}`;
        }

        let width = size.width;
        let height = size.height;
        if (isLandscape && (size.frameType === 'mobile' || size.frameType === 'tablet')) {
          [width, height] = [height, width];
        }

        if (showDeviceFrame && size.hasFrame) {
          const frameWidth = size.frameType === 'mobile' ? (isLandscape ? 120 : 40) : 60;
          const frameHeight = size.frameType === 'mobile' ? (isLandscape ? 80 : 80) : isLandscape ? 60 : 100;
          const newWindow = window.open('', '_blank', `width=${width + frameWidth},height=${height + frameHeight + 40},menubar=no,toolbar=no,location=no,status=no`);
          if (!newWindow) { console.error('Failed to open new window'); return; }

          const frameColor = getFrameColor();
          const frameRadius = size.frameType === 'mobile' ? '36px' : '20px';
          const framePadding = size.frameType === 'mobile' ? (isLandscape ? '40px 60px' : '40px 20px') : (isLandscape ? '30px 50px' : '50px 30px');
          const notchTop = isLandscape ? '50%' : '20px'; const notchLeft = isLandscape ? '30px' : '50%';
          const notchTransform = isLandscape ? 'translateY(-50%)' : 'translateX(-50%)';
          const notchWidth = isLandscape ? '8px' : size.frameType === 'mobile' ? '60px' : '80px';
          const notchHeight = isLandscape ? (size.frameType === 'mobile' ? '60px' : '80px') : '8px';
          const homeBottom = isLandscape ? '50%' : '15px'; const homeRight = isLandscape ? '30px' : '50%';
          const homeTransform = isLandscape ? 'translateY(50%)' : 'translateX(50%)';
          const homeWidth = isLandscape ? '4px' : '40px'; const homeHeight = isLandscape ? '40px' : '4px';

          const htmlContent = `
            <!DOCTYPE html><html><head><meta charset="utf-8"><title>${size.name} Preview</title><style>
            body { margin:0;padding:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#f0f0f0;overflow:hidden;font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            .device-container{position:relative;} .device-name{position:absolute;top:-30px;left:0;right:0;text-align:center;font-size:14px;color:#333;}
            .device-frame{position:relative;border-radius:${frameRadius};background:${frameColor};padding:${framePadding};box-shadow:0 10px 30px rgba(0,0,0,0.2);overflow:hidden;}
            .device-frame:before{content:'';position:absolute;top:${notchTop};left:${notchLeft};transform:${notchTransform};width:${notchWidth};height:${notchHeight};background:#333;border-radius:4px;z-index:2;}
            .device-frame:after{content:'';position:absolute;bottom:${homeBottom};right:${homeRight};transform:${homeTransform};width:${homeWidth};height:${homeHeight};background:#333;border-radius:50%;z-index:2;}
            iframe{border:none;width:${width}px;height:${height}px;background:white;display:block;}
            </style></head><body><div class="device-container"><div class="device-name">${size.name} ${isLandscape ? '(Landscape)' : '(Portrait)'}</div>
            <div class="device-frame"><iframe src="${previewUrl}" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin" allow="cross-origin-isolated"></iframe>
            </div></div></body></html>`;
          newWindow.document.open(); newWindow.document.write(htmlContent); newWindow.document.close();
        } else {
          const newWindow = window.open(previewUrl, '_blank', `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`);
          if (newWindow) newWindow.focus();
        }
      } else {
        console.warn('[Preview] Invalid WebContainer URL:', activePreview.baseUrl);
      }
    }
  };

  const openInNewTab = () => {
    if (activePreview?.baseUrl) {
        let fullUrl = activePreview.baseUrl;
        if(displayPath && displayPath !== '/') {
            fullUrl += displayPath.startsWith('/') ? displayPath : `/${displayPath}`;
        }
      window.open(fullUrl, '_blank');
    }
  };

  const getFramePadding = useCallback(() => {
    if (!selectedWindowSize) return '40px 20px';
    const isMobile = selectedWindowSize.frameType === 'mobile';
    return isLandscape ? (isMobile ? '40px 60px' : '30px 50px') : (isMobile ? '40px 20px' : '50px 30px');
  }, [isLandscape, selectedWindowSize]);

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleColorSchemeChange = () => { if (showDeviceFrameInPreview) setShowDeviceFrameInPreview(true); }; // Re-render to update getFrameColor
    darkModeMediaQuery.addEventListener('change', handleColorSchemeChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleColorSchemeChange);
  }, [showDeviceFrameInPreview, getFrameColor]); // Added getFrameColor to dependencies

  const renderIframe = (isDeviceFramed: boolean) => {
    // Cette fonction est appelée seulement si activePreview est vrai
    // Donc l'iframeElement sera toujours celui avec une src valide
    const iframeElement = (
      <iframe
        ref={iframeRef}
        title="preview"
        style={
          isDeviceFramed && !isExpoTemplate // Appliquer les styles de device frame seulement si ce n'est PAS un template Expo (car Expo a son propre frame stylisé)
            ? { // Styles pour le device frame générique (non-Expo)
                border: 'none',
                width: isLandscape ? `${selectedWindowSize.height}px` : `${selectedWindowSize.width}px`,
                height: isLandscape ? `${selectedWindowSize.width}px` : `${selectedWindowSize.height}px`,
                background: 'white',
                display: 'block',
              }
            : { /* Styles pour l'iframe responsive (non-Expo et non-device-frame) ou iframe DANS le téléphone Expo sont gérés par className ou styles inline plus bas */ }
        }
        className={(!isDeviceFramed || isExpoTemplate) ? "border-none w-full h-full bg-bolt-elements-background-depth-1" : ""}
        src={iframeUrl} // iframeUrl est défini et mis à jour dans le useEffect [activePreview]
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
        allow={
          (isDeviceFramed && !isExpoTemplate) || isExpoTemplate // Pour le device frame générique ou le frame Expo
            ? "cross-origin-isolated"
            : "geolocation; ch-ua-full-version-list; cross-origin-isolated; screen-wake-lock; publickey-credentials-get; shared-storage-select-url; ch-ua-arch; bluetooth; compute-pressure; ch-prefers-reduced-transparency; deferred-fetch; usb; ch-save-data; publickey-credentials-create; shared-storage; deferred-fetch-minimal; run-ad-auction; ch-ua-form-factors; ch-downlink; otp-credentials; payment; ch-ua; ch-ua-model; ch-ect; autoplay; camera; private-state-token-issuance; accelerometer; ch-ua-platform-version; idle-detection; private-aggregation; interest-cohort; ch-viewport-height; local-fonts; ch-ua-platform; midi; ch-ua-full-version; xr-spatial-tracking; clipboard-read; gamepad; display-capture; keyboard-map; join-ad-interest-group; ch-width; ch-prefers-reduced-motion; browsing-topics; encrypted-media; gyroscope; serial; ch-rtt; ch-ua-mobile; window-management; unload; ch-dpr; ch-prefers-color-scheme; ch-ua-wow64; attribution-reporting; fullscreen; identity-credentials-get; private-state-token-redemption; hid; ch-ua-bitness; storage-access; sync-xhr; ch-device-memory; ch-viewport-width; picture-in-picture; magnetometer; clipboard-write; microphone"
        }
      />
    );
    // Pour le template Expo, le wrapping dans le téléphone est géré à l'extérieur.
    // Pour les autres templates, cette fonction retourne juste l'iframe.
    return iframeElement;
  };


  return (
    <div ref={containerRef} className={`w-full h-full flex flex-col relative`}>
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      {isExpoTemplate && (
        <div className="bg-bolt-elements-background-depth-2 p-2 sr-only items-center gap-2">
        {/* Barre d'outils supérieure ... */}
        <div className="flex items-center gap-2">
          <IconButton icon="i-ph:arrow-clockwise" onClick={reloadPreview} title="Reload Preview"/>
          <IconButton
            icon="i-ph:selection"
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={isSelectionMode ? 'bg-bolt-elements-background-depth-3' : ''}
            title="Toggle Screenshot Selection Mode"
          />
        </div>

        <div className="flex-grow flex items-center gap-1 bg-bolt-elements-preview-addressBar-background border border-bolt-elements-borderColor text-bolt-elements-preview-addressBar-text rounded-full px-1 py-1 text-sm hover:bg-bolt-elements-preview-addressBar-backgroundHover hover:focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within-border-bolt-elements-borderColorActive focus-within:text-bolt-elements-preview-addressBar-textActive">
          <PortDropdown
            activePreviewIndex={activePreviewIndex}
            setActivePreviewIndex={setActivePreviewIndex}
            isDropdownOpen={isPortDropdownOpen}
            setHasSelectedPreview={(value) => (hasSelectedPreview.current = value)}
            setIsDropdownOpen={setIsPortDropdownOpen}
            previews={previews}
          />
          <input
            title="URL Path"
            ref={inputRef}
            className="w-full bg-transparent outline-none"
            type="text"
            value={displayPath}
            onChange={(event) => setDisplayPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && activePreview) {
                let targetPath = displayPath.trim();
                if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;
                const fullUrl = activePreview.baseUrl + targetPath;
                setIframeUrl(fullUrl);
                setDisplayPath(targetPath);
                if (inputRef.current) inputRef.current.blur();
              }
            }}
            disabled={!activePreview}
          />
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            icon="i-ph:devices"
            onClick={toggleDeviceMode}
            title={isDeviceModeOn ? 'Switch to Responsive Mode' : 'Switch to Device Mode'}
          />
          {expoUrl && <IconButton icon="i-ph:qr-code" onClick={() => setIsExpoQrModalOpen(true)} title="Show Expo QR Code" />}
          <ExpoQrModal open={isExpoQrModalOpen} onClose={() => setIsExpoQrModalOpen(false)} />
          {isDeviceModeOn && (
            <>
              <IconButton
                icon="i-ph:device-rotate"
                onClick={() => setIsLandscape(!isLandscape)}
                title={isLandscape ? 'Switch to Portrait' : 'Switch to Landscape'}
              />
              <IconButton
                icon={showDeviceFrameInPreview ? 'i-ph:device-mobile' : 'i-ph:device-mobile-slash'}
                onClick={() => setShowDeviceFrameInPreview(!showDeviceFrameInPreview)}
                title={showDeviceFrameInPreview ? 'Hide Device Frame in Preview' : 'Show Device Frame in Preview'}
              />
            </>
          )}
          <IconButton
            icon={isFullscreen ? 'i-ph:arrows-in' : 'i-ph:arrows-out'}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          />
          <div className="flex items-center relative">
            <IconButton
              icon="i-ph:list"
              onClick={() => setIsWindowSizeDropdownOpen(!isWindowSizeDropdownOpen)}
              title="New Window Options"
            />
            {isWindowSizeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setIsWindowSizeDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 min-w-[240px] max-h-[400px] overflow-y-auto bg-white dark:bg-black rounded-xl shadow-2xl border border-[#E5E7EB] dark:border-[rgba(255,255,255,0.1)] overflow-hidden">
                  <div className="p-3 border-b border-[#E5E7EB] dark:border-[rgba(255,255,255,0.1)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#111827] dark:text-gray-300">Window Options</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        className={`flex w-full justify-between items-center text-start bg-transparent text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary`}
                        onClick={openInNewTab}
                      >
                        <span>Open in new tab</span>
                        <div className="i-ph:arrow-square-out h-5 w-4" />
                      </button>
                      <button
                        className={`flex w-full justify-between items-center text-start bg-transparent text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary`}
                        onClick={() => {
                          if (!activePreview?.baseUrl) { console.warn('[Preview] No active preview available'); return; }
                          const match = activePreview.baseUrl.match(/^https?:\/\/([^.]+)\.local-credentialless\.webcontainer-api\.io/);
                          if (!match) { console.warn('[Preview] Invalid WebContainer URL:', activePreview.baseUrl); return; }
                          const previewId = match[1];
                          let previewUrl = `/webcontainer/preview/${previewId}`;
                          if(displayPath && displayPath !== '/') {
                            previewUrl += displayPath.startsWith('/') ? displayPath : `/${displayPath}`;
                          }
                          window.open(previewUrl, `preview-${previewId}`, 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
                        }}
                      >
                        <span>Open in new window</span>
                        <div className="i-ph:browser h-5 w-4" />
                      </button>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-bolt-elements-textTertiary">Show Device Frame</span>
                        <button
                          className={`w-10 h-5 rounded-full transition-colors duration-200 ${showDeviceFrame ? 'bg-[#6D28D9]' : 'bg-gray-300 dark:bg-gray-700'} relative`}
                          onClick={(e) => { e.stopPropagation(); setShowDeviceFrame(!showDeviceFrame); }}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${showDeviceFrame ? 'transform translate-x-5' : ''}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-bolt-elements-textTertiary">Landscape Mode</span>
                        <button
                          className={`w-10 h-5 rounded-full transition-colors duration-200 ${isLandscape ? 'bg-[#6D28D9]' : 'bg-gray-300 dark:bg-gray-700'} relative`}
                          onClick={(e) => { e.stopPropagation(); setIsLandscape(!isLandscape); }}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${isLandscape ? 'transform translate-x-5' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {WINDOW_SIZES.map((size) => (
                    <button
                      key={size.name}
                      className="w-full px-4 py-3.5 text-left text-[#111827] dark:text-gray-300 text-sm whitespace-nowrap flex items-center gap-3 group hover:bg-[#F5EEFF] dark:hover:bg-gray-900 bg-white dark:bg-black"
                      onClick={() => { setSelectedWindowSize(size); setIsWindowSizeDropdownOpen(false); openInNewWindow(size); }}
                    >
                      <div className={`${size.icon} w-5 h-5 text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200`} />
                      <div className="flex-grow flex flex-col">
                        <span className="font-medium group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">{size.name}</span>
                        <span className="text-xs text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">
                          {isLandscape && (size.frameType === 'mobile' || size.frameType === 'tablet') ? `${size.height} × ${size.width}` : `${size.width} × ${size.height}`}
                          {size.hasFrame && showDeviceFrame ? ' (with frame)' : ''}
                        </span>
                      </div>
                      {selectedWindowSize.name === size.name && (
                        <div className="text-[#6D28D9] dark:text-[#6D28D9]">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}
      {isExpoTemplate && (
        <div className=" p-2 flex items-center gap-2">
          {/* Barre d'outils supérieure ... */}
          <div className="flex items-center justify-center bg-[#fafafa] cursor-pointer gap-2 h-[35px] w-[35px] top-2 rounded-[12px] border border-[#EEE] absolute right-15 ">
          {expoUrl && <IconButton icon="i-ph:qr-code" onClick={() => setIsExpoQrModalOpen(true)} title="Show QR" />}
          </div>
          
          <div className="flex items-center justify-center bg-[#fafafa] cursor-pointer gap-2 h-[35px] w-[35px] top-2 rounded-[12px] border border-[#EEE] absolute right-3 ">
            <IconButton icon="i-ph:arrow-clockwise" onClick={reloadPreview} title="Reload Preview"/>
          </div>
        </div>
      )}
      {!isExpoTemplate && (
        <div className="bg-bolt-elements-background-depth-2 p-2 flex items-center gap-2">
        {/* Barre d'outils supérieure ... */}
        <div className="flex items-center gap-2">
          <IconButton icon="i-ph:arrow-clockwise" onClick={reloadPreview} title="Reload Preview"/>
          <IconButton
            icon="i-ph:selection"
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={isSelectionMode ? 'bg-bolt-elements-background-depth-3' : ''}
            title="Toggle Screenshot Selection Mode"
          />
        </div>

        <div className="flex-grow flex items-center gap-1 bg-bolt-elements-preview-addressBar-background border border-bolt-elements-borderColor text-bolt-elements-preview-addressBar-text rounded-full px-1 py-1 text-sm hover:bg-bolt-elements-preview-addressBar-backgroundHover hover:focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within-border-bolt-elements-borderColorActive focus-within:text-bolt-elements-preview-addressBar-textActive">
          <PortDropdown
            activePreviewIndex={activePreviewIndex}
            setActivePreviewIndex={setActivePreviewIndex}
            isDropdownOpen={isPortDropdownOpen}
            setHasSelectedPreview={(value) => (hasSelectedPreview.current = value)}
            setIsDropdownOpen={setIsPortDropdownOpen}
            previews={previews}
          />
          <input
            title="URL Path"
            ref={inputRef}
            className="w-full bg-transparent outline-none"
            type="text"
            value={displayPath}
            onChange={(event) => setDisplayPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && activePreview) {
                let targetPath = displayPath.trim();
                if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;
                const fullUrl = activePreview.baseUrl + targetPath;
                setIframeUrl(fullUrl);
                setDisplayPath(targetPath);
                if (inputRef.current) inputRef.current.blur();
              }
            }}
            disabled={!activePreview}
          />
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            icon="i-ph:devices"
            onClick={toggleDeviceMode}
            title={isDeviceModeOn ? 'Switch to Responsive Mode' : 'Switch to Device Mode'}
          />
          {expoUrl && <IconButton icon="i-ph:qr-code" onClick={() => setIsExpoQrModalOpen(true)} title="Show Expo QR Code" />}
          <ExpoQrModal open={isExpoQrModalOpen} onClose={() => setIsExpoQrModalOpen(false)} />
          {isDeviceModeOn && (
            <>
              <IconButton
                icon="i-ph:device-rotate"
                onClick={() => setIsLandscape(!isLandscape)}
                title={isLandscape ? 'Switch to Portrait' : 'Switch to Landscape'}
              />
              <IconButton
                icon={showDeviceFrameInPreview ? 'i-ph:device-mobile' : 'i-ph:device-mobile-slash'}
                onClick={() => setShowDeviceFrameInPreview(!showDeviceFrameInPreview)}
                title={showDeviceFrameInPreview ? 'Hide Device Frame in Preview' : 'Show Device Frame in Preview'}
              />
            </>
          )}
          <IconButton
            icon={isFullscreen ? 'i-ph:arrows-in' : 'i-ph:arrows-out'}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          />
          <div className="flex items-center relative">
            <IconButton
              icon="i-ph:list"
              onClick={() => setIsWindowSizeDropdownOpen(!isWindowSizeDropdownOpen)}
              title="New Window Options"
            />
            {isWindowSizeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setIsWindowSizeDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 min-w-[240px] max-h-[400px] overflow-y-auto bg-white dark:bg-black rounded-xl shadow-2xl border border-[#E5E7EB] dark:border-[rgba(255,255,255,0.1)] overflow-hidden">
                  <div className="p-3 border-b border-[#E5E7EB] dark:border-[rgba(255,255,255,0.1)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#111827] dark:text-gray-300">Window Options</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        className={`flex w-full justify-between items-center text-start bg-transparent text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary`}
                        onClick={openInNewTab}
                      >
                        <span>Open in new tab</span>
                        <div className="i-ph:arrow-square-out h-5 w-4" />
                      </button>
                      <button
                        className={`flex w-full justify-between items-center text-start bg-transparent text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary`}
                        onClick={() => {
                          if (!activePreview?.baseUrl) { console.warn('[Preview] No active preview available'); return; }
                          const match = activePreview.baseUrl.match(/^https?:\/\/([^.]+)\.local-credentialless\.webcontainer-api\.io/);
                          if (!match) { console.warn('[Preview] Invalid WebContainer URL:', activePreview.baseUrl); return; }
                          const previewId = match[1];
                          let previewUrl = `/webcontainer/preview/${previewId}`;
                          if(displayPath && displayPath !== '/') {
                            previewUrl += displayPath.startsWith('/') ? displayPath : `/${displayPath}`;
                          }
                          window.open(previewUrl, `preview-${previewId}`, 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
                        }}
                      >
                        <span>Open in new window</span>
                        <div className="i-ph:browser h-5 w-4" />
                      </button>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-bolt-elements-textTertiary">Show Device Frame</span>
                        <button
                          className={`w-10 h-5 rounded-full transition-colors duration-200 ${showDeviceFrame ? 'bg-[#6D28D9]' : 'bg-gray-300 dark:bg-gray-700'} relative`}
                          onClick={(e) => { e.stopPropagation(); setShowDeviceFrame(!showDeviceFrame); }}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${showDeviceFrame ? 'transform translate-x-5' : ''}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-bolt-elements-textTertiary">Landscape Mode</span>
                        <button
                          className={`w-10 h-5 rounded-full transition-colors duration-200 ${isLandscape ? 'bg-[#6D28D9]' : 'bg-gray-300 dark:bg-gray-700'} relative`}
                          onClick={(e) => { e.stopPropagation(); setIsLandscape(!isLandscape); }}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${isLandscape ? 'transform translate-x-5' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {WINDOW_SIZES.map((size) => (
                    <button
                      key={size.name}
                      className="w-full px-4 py-3.5 text-left text-[#111827] dark:text-gray-300 text-sm whitespace-nowrap flex items-center gap-3 group hover:bg-[#F5EEFF] dark:hover:bg-gray-900 bg-white dark:bg-black"
                      onClick={() => { setSelectedWindowSize(size); setIsWindowSizeDropdownOpen(false); openInNewWindow(size); }}
                    >
                      <div className={`${size.icon} w-5 h-5 text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200`} />
                      <div className="flex-grow flex flex-col">
                        <span className="font-medium group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">{size.name}</span>
                        <span className="text-xs text-[#6B7280] dark:text-gray-400 group-hover:text-[#6D28D9] dark:group-hover:text-[#6D28D9] transition-colors duration-200">
                          {isLandscape && (size.frameType === 'mobile' || size.frameType === 'tablet') ? `${size.height} × ${size.width}` : `${size.width} × ${size.height}`}
                          {size.hasFrame && showDeviceFrame ? ' (with frame)' : ''}
                        </span>
                      </div>
                      {selectedWindowSize.name === size.name && (
                        <div className="text-[#6D28D9] dark:text-[#6D28D9]">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}
      <div className="flex-1  border-bolt-elements-borderColor flex justify-center items-center overflow-auto">
        <div
          style={{
            width: isDeviceModeOn ? (showDeviceFrameInPreview && !isExpoTemplate ? '100%' : `${widthPercent}%`) : '100%', // Si c'est Expo, on utilise widthPercent même avec showDeviceFrameInPreview pour contrôler la taille du téléphone via les handles
            height: '100%',
            overflow: (isExpoTemplate || (isDeviceModeOn && showDeviceFrameInPreview)) ? 'visible' : 'auto', // 'visible' pour que le scale/frame ne coupe pas
            background: 'var(--bolt-elements-background-depth-1)',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* --- MODIFICATION MAJEURE POUR LE CONTENU DE LA PREVIEW --- */}
          {isExpoTemplate ? (
            // CAS EXPO: Affiche toujours le téléphone stylisé
            <div
              className="expo-iframe-outer-wrapper " // Le fond noir de l'outer wrapper
              style={{
                // Ce wrapper permet de centrer le téléphone si besoin, ou d'appliquer un scale global au téléphone
                width: '100%', // Prend toute la place disponible dans son parent
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden', // Pour cacher ce qui dépasse du téléphone si on le scale
              }}
            >
              {/* Votre structure de téléphone stylisée */}
              <div className=" h-[550px] fixed z-[9999] w-[300px]  top-30 bg-[#000] rounded-[40px] border-[7px] border-[#0A0A0A]   ring ring-[#222] shadow-xl">
                <div className="absolute top-11 -right-[9px] bg-[#111] w-[3px] h-[5px] z-[9999]"></div>
                <div className="absolute top-11 -right-[9px] bg-[#111] w-[3px] h-[5px] z-[9999]"></div>
                <div className="absolute top-11 -right-[10px] bg-[#111] w-[3px] h-[5px] z-[9999]"></div>
                <div className="absolute bottom-12 -right-[10px] bg-[#111] w-[3px] h-[5px] z-[9999]"></div>
                <div className="absolute bottom-12 -right-[10px] bg-[#111] w-[3px] h-[5px] z-[9999]"></div>
                <div className="absolute top-11 -left-[10px] bg-[#111] w-[3px] h-[5px] z-[9999]"></div>
                <div className="absolute bottom-[335px]  -right-[11px] rounded-tr-[5px] rounded-br-[5px] bg-[#222] w-[3px] h-[55px] z-[9999]"></div>
                <div className="absolute top-28 -left-[11px] rounded-tl-[5px] rounded-bl-[5px] bg-[#222] w-[3px] h-[25px] z-[9999]"></div>
                <div className="absolute top-40 -left-[11px] rounded-tl-[5px] rounded-bl-[5px] bg-[#222] w-[3px] h-[35px] z-[9999]"></div>
                <div className="absolute top-52 -left-[11px] rounded-tl-[5px] rounded-bl-[5px] bg-[#222] w-[3px] h-[35px] z-[9999]"></div>
                <div className="absolute -bottom-[10px] left-[44px]  bg-[#111] w-[4px] h-[4px] z-[9999]"></div>
                <div className="absolute top-11 -left-[10px] bg-[#111] w-[3px] h-[3px] z-[9999]"></div>
                <div className="absolute bottom-12 -left-[10px] bg-[#111] w-[3px] h-[5px] z-[9999]"></div>
                <div className="absolute bottom-12 -left-[10px] bg-[#111] w-[3px] h-[5px] z-[9999]"></div>
                <div className="absolute top-0 w-full left-0 flex items-center justify-center">
                  <div className="  top-3 relative h-[30px] w-[100px] rounded-[20px] bg-[#0A0A0A] "></div>
                  </div>
                <div className="relative sr-only">
                  <div className="mr-5 mt-2 flex justify-end space-x-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>
                  </div>
                </div>
                {/* Contenu interne du téléphone */}
                <div className="rounded-[35px]  w-full h-full">
                  <div className="w-full rounded-[35px] h-full flex items-center  flex-col gap-2">
                    <div className="h-[100%] rounded-[35px] w-full">
                      <div className="h-full w-full p-[1px]">
                        {activePreview ? (
                           <iframe
                           ref={iframeRef}
                           title="preview"
                           style={{
                             border: 'none',
                             width: '100%',
                             height: '100%',
                             background: 'white',
                             display: 'block',
                             borderRadius: '34px' // Coins arrondis pour l'intérieur du téléphone
                           }}
                           src={iframeUrl}
                           sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
                           allow="cross-origin-isolated"
                         />
                        ) : (
                          <div className="flex w-full h-full justify-center items-center text-white text-sm">
                            No preview available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {activePreview && ( /* ScreenshotSelector seulement si une preview est active */
                <ScreenshotSelector
                    isSelectionMode={isSelectionMode}
                    setIsSelectionMode={setIsSelectionMode}
                    containerRef={iframeRef}
                />
              )}
            </div>
          ) : (
            // CAS NON-EXPO: Logique existante pour les autres templates
            <>
              {activePreview ? (
                <>
                  {isDeviceModeOn && showDeviceFrameInPreview ? (
                    <div
                      className="device-wrapper"
                      style={{
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        width: '100%', height: '100%', padding: '0',
                        overflow: 'auto',
                        transition: 'all 0.3s ease', position: 'relative',
                      }}
                    >
                      <div
                        className="device-frame-container"
                        style={{
                          position: 'relative',
                          borderRadius: selectedWindowSize.frameType === 'mobile' ? '36px' : '20px',
                          background: getFrameColor(),
                          padding: getFramePadding(),
                          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                          overflow: 'hidden',
                          transform: 'scale(1)',
                          transformOrigin: 'center center',
                          transition: 'all 0.3s ease',
                          margin: '40px',
                          width: isLandscape
                            ? `${selectedWindowSize.height + (selectedWindowSize.frameType === 'mobile' ? 120 : 60)}px`
                            : `${selectedWindowSize.width + (selectedWindowSize.frameType === 'mobile' ? 40 : 60)}px`,
                          height: isLandscape
                            ? `${selectedWindowSize.width + (selectedWindowSize.frameType === 'mobile' ? 80 : 60)}px`
                            : `${selectedWindowSize.height + (selectedWindowSize.frameType === 'mobile' ? 80 : 100)}px`,
                        }}
                      >
                        <div style={{ position: 'absolute', top: isLandscape ? '50%' : '20px', left: isLandscape ? '30px' : '50%', transform: isLandscape ? 'translateY(-50%)' : 'translateX(-50%)', width: isLandscape ? '8px' : selectedWindowSize.frameType === 'mobile' ? '60px' : '80px', height: isLandscape ? (selectedWindowSize.frameType === 'mobile' ? '60px' : '80px') : '8px', background: '#333', borderRadius: '4px', zIndex: 2 }} />
                        <div style={{ position: 'absolute', bottom: isLandscape ? '50%' : '15px', right: isLandscape ? '30px' : '50%', transform: isLandscape ? 'translateY(50%)' : 'translateX(50%)', width: isLandscape ? '4px' : '40px', height: isLandscape ? '40px' : '4px', background: '#333', borderRadius: '50%', zIndex: 2 }} />
                        {renderIframe(true)}
                      </div>
                    </div>
                  ) : (
                    renderIframe(false)
                  )}
                  <ScreenshotSelector
                    isSelectionMode={isSelectionMode}
                    setIsSelectionMode={setIsSelectionMode}
                    containerRef={iframeRef}
                  />
                </>
              ) : (
                <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
                  No preview available
                </div>
              )}
            </>
          )}
          {/* --- FIN MODIFICATION MAJEURE --- */}

          {isDeviceModeOn && !showDeviceFrameInPreview && (
            <>
              <div style={{ position: 'absolute', top: '-25px', left: '50%', transform: 'translateX(-50%)', background: 'var(--bolt-elements-background-depth-3, rgba(0,0,0,0.7))', color: 'var(--bolt-elements-textPrimary, white)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', pointerEvents: 'none', opacity: resizingState.current.isResizing ? 1 : 0, transition: 'opacity 0.3s' }}>
                {currentWidth}px
              </div>
              <ResizeHandle side="left" />
              <ResizeHandle side="right" />
            </>
          )}
        </div>
      </div>
    </div>
  );
});
