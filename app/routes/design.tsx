// La première ligne import { Hand, Play } from "lucide-react" est redondante si Play est déjà importé plus bas
// et Hand n'est pas utilisé. Je la commente.
// import { Hand, Play } from "lucide-react" 

import React, { useState, type ReactNode } from 'react'; // Assure-toi que ReactNode est bien importé
import {
    // Play, // Commenté car non utilisé directement dans cette partie
    Box, 
    Rows, 
    Columns, 
    Square, 
    List, 
    Grid, 
    Image as ImageIcon, 
    Type, 
    FileText, 
    RectangleHorizontal, 
    Smile, 
    ChevronsUpDown, 
    MousePointer, 
    CheckSquare, 
    ToggleLeft, 
    ToggleRight, 
    FileWarning, 
    Table, 
    Palette,
    ClipboardCopy, // NOUVEAU
    Code as CodeIcon, // NOUVEAU - Renommé pour éviter conflit avec le tag <code>
    Smartphone, // NOUVEAU
    TabletSmartphone // NOUVEAU
  } from "lucide-react";
  
  // Types pour nos éléments
  interface AvailableComponent {
    id: string;
    name: string;
    icon: ReactNode; 
    defaultContent: string;
  }
  
  interface ScreenElementType {
    id: string;
    type: string;
    name: string;
    content: string;
    properties: Record<string, any>; 
    style?: React.CSSProperties; 
  }

  // Props pour Sidebar
  interface SidebarProps { 
    onAddComponent: (type: string, name: string, defaultContent: string) => void;
  }

  interface ScreenElementProps {
    id: string;
    type: string;
    content: string;
    properties: Record<string, any>; 
    style?: React.CSSProperties;
    isSelected: boolean;
    onSelect: (id: string) => void;
  }
  
  // 1. Définir les composants disponibles
  const availableComponentsList: AvailableComponent[] = [ 
    { id: 'container', name: 'Container', icon: <Box size={20} />, defaultContent: "Container" },
    { id: 'row', name: 'Row', icon: <Rows size={20} />, defaultContent: "Row" },
    { id: 'column', name: 'Column', icon: <Columns size={20} />, defaultContent: "Column" },
    { id: 'card', name: 'Card', icon: <Square size={20} />, defaultContent: "Card Content" }, 
    { id: 'listview', name: 'ListView', icon: <List size={20} />, defaultContent: "Default List Item" },
    { id: 'gridview', name: 'GridView', icon: <Grid size={20} />, defaultContent: "Default Grid Item" },
    { id: 'carousel', name: 'Carousel', icon: <ImageIcon size={20} />, defaultContent: "Carousel Slide" },
    { id: 'form', name: 'Form Validation', icon: <FileWarning size={20} />, defaultContent: "Form Area" },
    { id: 'datatable', name: 'DataTable', icon: <Table size={20} />, defaultContent: "Data Table" },
    { id: 'text', name: 'Text', icon: <Type size={20} />, defaultContent: "Sample Text" },
    { id: 'richtext', name: 'Rich Text', icon: <FileText size={20} />, defaultContent: "<b>Rich</b> <i>Text</i> Content" },
    { id: 'image', name: 'Image', icon: <ImageIcon size={20} />, defaultContent: "Image Placeholder" },
    { id: 'circleimage', name: 'Circle Image', icon: <ImageIcon size={20} />, defaultContent: "Profile" },
    { id: 'button', name: 'Button', icon: <RectangleHorizontal size={20} />, defaultContent: "Click Me" },
    { id: 'icon', name: 'Icon', icon: <Smile size={20} />, defaultContent: "Icon Label" },
    { id: 'iconbutton', name: 'IconButton', icon: <MousePointer size={20} />, defaultContent: "" }, 
    { id: 'checkbox', name: 'Checkbox', icon: <CheckSquare size={20} />, defaultContent: "Checkbox Label" },
    { id: 'switch', name: 'Switch', icon: <ToggleLeft size={20} />, defaultContent: "Switch Label" },
    { id: 'toggle', name: 'Toggle', icon: <ToggleRight size={20} />, defaultContent: "Toggle Button" },
  ];
  

// 2. Composant Sidebar (inchangé)
const Sidebar: React.FC<SidebarProps> = ({ onAddComponent }) => {
  return (
    <div className="h-full w-[20%] bg-[#FFF] p-4 border-r border-gray-200 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">Layout Elements</h2>
      <div className="space-y-2">
        {availableComponentsList.map((component) => (
          <button
            key={component.id}
            onClick={() => onAddComponent(component.id, component.name, component.defaultContent)}
            className="w-full flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
          >
            {component.icon}
            <span>{component.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const ScreenElement: React.FC<ScreenElementProps> = ({ type, content, id, properties, style, isSelected, onSelect }) => { 
  const selectionClass = isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:ring-1 hover:ring-blue-300';
  const baseWrapperStyle = `my-1 cursor-pointer transition-all ${selectionClass}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    onSelect(id);
  };

  switch (type) {
    case 'container':
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <div style={style} className={`p-4 bg-gray-200 min-h-[50px] rounded`}>
                <span className="text-xs text-gray-500 block text-center">{content}</span>
            </div>
        </div>
      );
    case 'row':
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <div style={style} className={`p-2 bg-rose-100 min-h-[40px] rounded flex flex-row gap-2 items-center`}>
                <span className="text-xs text-rose-600">{content}</span>
                <div className="flex-grow h-6 bg-rose-200 rounded"></div>
                <div className="flex-grow h-6 bg-rose-200 rounded"></div>
            </div>
        </div>
      );
    case 'column':
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <div style={style} className={`p-2 bg-sky-100 min-h-[60px] rounded flex flex-col gap-2`}>
                <span className="text-xs text-sky-600">{content}</span>
                <div className="w-full h-6 bg-sky-200 rounded"></div>
                <div className="w-full h-6 bg-sky-200 rounded"></div>
            </div>
        </div>
      );
    case 'card':
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <div style={style} className={`p-4 bg-white rounded-lg shadow-md`}>
                <h3 className="font-semibold text-gray-700 mb-1 text-sm">Card Title</h3>
                <p className="text-xs text-gray-500">{content}</p>
            </div>
        </div>
      );
    case 'listview':
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <div style={style} className={`bg-white rounded shadow`}>
            {properties.items?.map((item: { id: string, text: string }, index: number) => (
                <div key={item.id || index} className="p-3 border-b border-gray-200 last:border-b-0">
                <p className="text-sm text-gray-700">{item.text}</p>
                </div>
            ))}
            {(!properties.items || properties.items.length === 0) && (
                <p className="p-3 text-sm text-gray-400">{content}</p>
            )}
            </div>
        </div>
      );
    case 'gridview':
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <div style={style} className={`grid grid-cols-2 gap-2 p-2 bg-indigo-50 rounded`}>
            {properties.items?.map((item: { id: string, color: string, text: string }, index: number) => (
                <div key={item.id || index} className={`p-4 h-20 rounded ${item.color || 'bg-indigo-200'} flex items-center justify-center`}>
                <span className="text-xs text-indigo-800 font-medium">{item.text}</span>
                </div>
            ))}
            {(!properties.items || properties.items.length === 0) && (
                Array.from({ length: 2 }).map((_, i) => ( 
                    <div key={i} className={`p-4 h-20 rounded bg-indigo-200 flex items-center justify-center`}>
                        <span className="text-xs text-indigo-800 font-medium">{content}</span>
                    </div>
                ))
            )}
            </div>
        </div>
      );
    case 'carousel':
        return (
            <div className={baseWrapperStyle} onClick={handleClick}>
                <div style={style} className={`h-32 bg-gray-300 rounded flex items-center justify-center text-gray-600`}>
                    <ImageIcon size={24} className="mr-2"/> <span className="text-sm">{content}</span>
                </div>
            </div>
        );
    case 'form':
        return (
            <div className={baseWrapperStyle} onClick={handleClick}>
                <div style={style} className={`p-3 border border-gray-300 rounded bg-gray-50`}>
                    <p className="text-sm text-gray-600">{content}</p>
                    <div className="mt-2 h-8 w-full bg-white border border-gray-300 rounded"></div>
                </div>
            </div>
        );
    case 'datatable':
        return (
            <div className={baseWrapperStyle} onClick={handleClick}>
                <div style={style} className={`p-2 border border-gray-300 rounded bg-gray-50 text-xs text-gray-500`}>
                    <Table size={14} className="inline mr-1"/> {content}
                    <div className="w-full mt-1 text-[10px]">
                        <div className="flex bg-gray-200"><div className="p-1 flex-1 border-r">Header1</div><div className="p-1 flex-1">Header2</div></div>
                        <div className="flex bg-white"><div className="p-1 flex-1 border-r">Data1.1</div><div className="p-1 flex-1">Data1.2</div></div>
                    </div>
                </div>
            </div>
        );
    case 'text':
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <p style={style} className={`text-sm text-gray-800 py-1`}>{content}</p>
        </div>
      );
    case 'richtext':
        return (
            <div className={baseWrapperStyle} onClick={handleClick}>
                <div style={style} className={`p-2 border border-gray-300 rounded min-h-[40px]`}>
                    <div dangerouslySetInnerHTML={{ __html: content }} className="text-sm prose prose-sm" /> 
                </div>
            </div>
        );
    case 'image':
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <div style={style} className={`w-full h-32 bg-gray-200 rounded flex items-center justify-center overflow-hidden`}>
            {properties.src ? (
                <img src={properties.src as string} alt={(properties.alt as string) || 'User image'} className="max-w-full max-h-full object-contain" />
            ) : (
                <div className="text-center text-gray-500">
                <ImageIcon size={32} className="mx-auto mb-1" />
                <p className="text-xs">{content}</p>
                </div>
            )}
            </div>
        </div>
      );
    case 'circleimage':
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <div style={style} className={`w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto overflow-hidden`}>
            {properties.src ? (
                <img src={properties.src as string} alt={(properties.alt as string) || 'User image'} className="w-full h-full object-cover rounded-full" />
            ) : (
                <div className="text-center text-gray-500">
                <ImageIcon size={24} className="mx-auto" />
                <p className="text-[10px] mt-1">{content}</p>
                </div>
            )}
            </div>
        </div>
      );
    case 'button':
      return (
         <div className={baseWrapperStyle} onClick={handleClick}>
            <button style={style} className={`font-semibold py-2 px-4 rounded-md w-full text-xs`}>
            {content}
            </button>
        </div>
      );
    case 'icon':
        return (
            <div className={baseWrapperStyle} onClick={handleClick}>
                <div style={style} className={`p-2 flex flex-col items-center justify-center`}>
                    <Smile size={24} className="text-yellow-500" />
                    <span className="mt-1 text-[10px] text-gray-500">{content}</span>
                </div>
            </div>
        );
    case 'iconbutton':
        return (
            <div className={baseWrapperStyle} onClick={handleClick}>
                <button style={style} className={`p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700`}>
                    <MousePointer size={18} />
                </button>
            </div>
        );
    case 'checkbox':
        return (
            <div className={baseWrapperStyle} onClick={handleClick}>
                <div style={style} className={`flex items-center p-1`}>
                    <input type="checkbox" id={`cb-${id}`} readOnly checked={properties.checked as boolean || false} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
                    <label htmlFor={`cb-${id}`} className="ml-2 text-xs text-gray-700">{content}</label>
                </div>
            </div>
        );
    case 'switch':
        const isSwitchChecked = properties.checked as boolean || false;
        return (
            <div className={baseWrapperStyle} onClick={handleClick}>
                <div style={style} className={`flex items-center p-1`}>
                    <button
                        type="button"
                        className={`${isSwitchChecked ? 'bg-green-500' : 'bg-gray-300'} relative inline-flex h-5 w-9 flex-shrink-0 cursor-default rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out`}
                        role="switch"
                        aria-checked={isSwitchChecked}
                    >
                        <span className={`${isSwitchChecked ? 'translate-x-4' : 'translate-x-0'} inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}/>
                    </button>
                    <span className="ml-2 text-xs text-gray-700">{content}</span>
                </div>
            </div>
        );
    case 'toggle':
        const isToggled = properties.checked as boolean || false;
        return (
            <div className={baseWrapperStyle} onClick={handleClick}>
                <button style={style} className={`${isToggled ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'} font-medium py-1.5 px-3 rounded-md text-xs w-full`}>
                    {content} {isToggled ? '(On)' : '(Off)'}
                </button>
            </div>
        );
    default:
      return (
        <div className={baseWrapperStyle} onClick={handleClick}>
            <div style={style} className={`p-2 border border-dashed border-gray-300 my-1 text-xs text-center bg-gray-100`}>
                {content} ({type})
            </div>
        </div>
      );
  }
};

interface PropertiesPanelProps {
    selectedElement: ScreenElementType | null;
    onUpdateElement: (id: string, newProps: Partial<ScreenElementType>) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedElement, onUpdateElement }) => {
    if (!selectedElement) {
        return (
            <div className="p-4 text-sm text-gray-500 h-full flex items-center justify-center">
                <p className="text-center">Sélectionnez un élément sur l'écran pour éditer ses propriétés.</p>
            </div>
        );
    }

    const handleContentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onUpdateElement(selectedElement.id, { content: e.target.value });
    };

    const handlePropertyChange = (propName: string, value: any) => {
        onUpdateElement(selectedElement.id, {
            properties: { ...selectedElement.properties, [propName]: value }
        });
    };

    const handleStyleChange = (property: keyof React.CSSProperties, value: string) => {
        onUpdateElement(selectedElement.id, { 
            style: { ...selectedElement.style, [property]: value } 
        });
    };
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                handlePropertyChange('src', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };


    return (
        <div className="p-4 space-y-4 text-xs">
            <h3 className="text-base font-semibold text-gray-800 mb-3 border-b pb-2">
                Éditer: <span className="font-bold text-blue-600">{selectedElement.name}</span>
            </h3>
            
            {(selectedElement.type === 'text' || 
              selectedElement.type === 'button' || 
              selectedElement.type === 'card' || 
              selectedElement.type === 'richtext' || 
              selectedElement.type === 'container' || 
              selectedElement.type === 'row' || 
              selectedElement.type === 'column'
             ) && (
                <div>
                    <label htmlFor="content" className="block text-xs font-medium text-gray-600 mb-1">Texte / Contenu</label>
                    {selectedElement.type === 'richtext' ? (
                        <textarea
                            id="content"
                            value={selectedElement.content}
                            onChange={handleContentChange}
                            rows={3}
                            className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-xs"
                        />
                    ) : (
                        <input
                            type="text"
                            id="content"
                            value={selectedElement.content}
                            onChange={handleContentChange}
                            className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-xs"
                        />
                    )}
                </div>
            )}

            {(selectedElement.type === 'image' || selectedElement.type === 'circleimage') && (
                <div className="space-y-1">
                    <label htmlFor="imageUpload" className="block text-xs font-medium text-gray-600">Image</label>
                    {selectedElement.properties.src && (
                        <img src={selectedElement.properties.src as string} alt="Aperçu" className="my-2 max-h-24 w-auto border rounded"/>
                    )}
                    <input
                        type="file"
                        id="imageUpload"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                     <label htmlFor="altText" className="block text-xs font-medium text-gray-600 mt-2">Texte alternatif (Alt)</label>
                    <input
                        type="text"
                        id="altText"
                        value={(selectedElement.properties.alt as string) || ''}
                        onChange={(e) => handlePropertyChange('alt', e.target.value)}
                        className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-xs"
                    />
                </div>
            )}

            {(selectedElement.type === 'checkbox' || selectedElement.type === 'switch' || selectedElement.type === 'toggle') && (
                 <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="checkedState"
                        checked={selectedElement.properties.checked as boolean || false}
                        onChange={(e) => handlePropertyChange('checked', e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="checkedState" className="ml-2 block text-xs font-medium text-gray-600">
                        Activé / Coché
                    </label>
                </div>
            )}

            <div className="pt-3 mt-3 border-t">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Styles Communs</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                        <label htmlFor="bgColor" className="block text-xs font-medium text-gray-600 mb-0.5">Fond</label>
                        <input type="color" id="bgColor" value={(selectedElement.style?.backgroundColor as string) || '#ffffff'} onChange={(e) => handleStyleChange('backgroundColor', e.target.value)} className="mt-1 block w-full h-7 px-0.5 py-0.5 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="textColor" className="block text-xs font-medium text-gray-600 mb-0.5">Texte</label>
                        <input type="color" id="textColor" value={(selectedElement.style?.color as string) || '#000000'} onChange={(e) => handleStyleChange('color', e.target.value)} className="mt-1 block w-full h-7 px-0.5 py-0.5 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="fontSize" className="block text-xs font-medium text-gray-600 mb-0.5">Taille police (px)</label>
                        <input type="number" id="fontSize" value={parseInt((selectedElement.style?.fontSize as string) || '14')} onChange={(e) => handleStyleChange('fontSize', `${e.target.value}px`)} className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-xs"/>
                    </div>
                     <div>
                        <label htmlFor="fontWeight" className="block text-xs font-medium text-gray-600 mb-0.5">Graisse</label>
                        <select id="fontWeight" value={(selectedElement.style?.fontWeight as string) || 'normal'} onChange={(e) => handleStyleChange('fontWeight', e.target.value)} className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-xs">
                            <option value="normal">Normal</option>
                            <option value="bold">Gras</option>
                            <option value="300">Léger (300)</option>
                            <option value="500">Moyen (500)</option>
                            <option value="700">Semi-gras (700)</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label htmlFor="padding" className="block text-xs font-medium text-gray-600 mb-0.5">Padding</label>
                        <input type="text" id="padding" value={(selectedElement.style?.padding as string) || ''} onChange={(e) => handleStyleChange('padding', e.target.value)} placeholder="ex: 10px ou 5px 10px" className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-xs"/>
                    </div>
                    <div className="col-span-2">
                        <label htmlFor="margin" className="block text-xs font-medium text-gray-600 mb-0.5">Margin</label>
                        <input type="text" id="margin" value={(selectedElement.style?.margin as string) || ''} onChange={(e) => handleStyleChange('margin', e.target.value)} placeholder="ex: 10px ou auto" className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-xs"/>
                    </div>
                     <div className="col-span-2">
                        <label htmlFor="borderRadius" className="block text-xs font-medium text-gray-600 mb-0.5">Bordure arrondie (px)</label>
                        <input type="number" id="borderRadius" value={parseInt((selectedElement.style?.borderRadius as string) || '0')} onChange={(e) => handleStyleChange('borderRadius', `${e.target.value}px`)} placeholder="ex: 8" className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-xs"/>
                    </div>
                     <div>
                        <label htmlFor="width" className="block text-xs font-medium text-gray-600 mb-0.5">Largeur</label>
                        <input type="text" id="width" value={(selectedElement.style?.width as string) || ''} onChange={(e) => handleStyleChange('width', e.target.value)} placeholder="ex: 100px ou 50%" className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-xs"/>
                    </div>
                     <div>
                        <label htmlFor="height" className="block text-xs font-medium text-gray-600 mb-0.5">Hauteur</label>
                        <input type="text" id="height" value={(selectedElement.style?.height as string) || ''} onChange={(e) => handleStyleChange('height', e.target.value)} placeholder="ex: 100px ou auto" className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-xs"/>
                    </div>
                    <div>
                        <label htmlFor="opacity" className="block text-xs font-medium text-gray-600 mb-0.5">Opacité (0-1)</label>
                        <input type="number" id="opacity" value={(selectedElement.style?.opacity as number) || 1} onChange={(e) => handleStyleChange('opacity', e.target.value)} step="0.1" min="0" max="1" className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-xs"/>
                    </div>
                </div>
            </div>
        </div>
    );
};

// NOUVEAU: Interface pour les options d'export et Composant ExportPanel
interface ExportOptions {
  format: 'html' | 'react' | 'react-native';
}
interface ExportPanelProps {
  screenElements: ScreenElementType[];
}

const ExportPanel: React.FC<ExportPanelProps> = ({ screenElements }) => {
  const [exportedCode, setExportedCode] = useState<string>('');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ format: 'html' });

  // --- Fonctions de génération de code (simplifiées) ---
  const elementToHTML = (element: ScreenElementType, indent = '  '): string => {
    let styleString = '';
    if (element.style) {
      styleString = Object.entries(element.style)
        .map(([key, value]) => `${key.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`)}:${value};`)
        .join('');
    }
  
    // Très basique, ne gère pas les classes Tailwind ni les enfants pour l'instant
    // et ne formate pas correctement les props comme `src` pour les images.
    const tagName = element.type === 'text' ? 'p' : element.type === 'button' ? 'button' : 'div';
    let content = element.content;
    let attributes = '';

    if (element.type === 'image') {
        attributes += ` src="${element.properties.src || ''}" alt="${element.properties.alt || ''}"`;
        content = ''; // Les images n'ont pas de contenu textuel de cette manière
        return `<img${attributes} style="${styleString}">`;
    }
     if (element.type === 'richtext') {
        return `<div style="${styleString}">${content}</div>`; // content est déjà HTML
    }
  
    return `${indent}<${tagName} style="${styleString}"${attributes}>${content}</${tagName}>`;
  };

  const elementToReact = (element: ScreenElementType, indent = '    '): string => {
    const styleObjectToString = (style?: React.CSSProperties): string => {
      if (!style || Object.keys(style).length === 0) return '{}';
      return JSON.stringify(style, null, 2).replace(/"([^"]+)":/g, '$1:'); // Formatage simple
    };

    const tagName = element.type === 'text' ? 'p' : element.type === 'button' ? 'button' : 'div';
    let propsString = `style={${styleObjectToString(element.style)}}`;
    let children = element.content;

    if (element.type === 'image') {
        propsString += ` src="${element.properties.src || ''}" alt="${element.properties.alt || ''}"`;
        children = '';
        return `${indent}<img ${propsString} />`;
    }
    if (element.type === 'richtext') {
        propsString += ` dangerouslySetInnerHTML={{ __html: \`${element.content.replace(/`/g, '\\`')}\` }}`; // Échapper les backticks
        children = '';
         return `${indent}<div ${propsString} />`;
    }
    // Gérer les autres types si nécessaire (ex: Checkbox avec checked prop)

    return `${indent}<${tagName} ${propsString}>${children}</${tagName}>`;
  };
  
  const elementToReactNative = (element: ScreenElementType, indent = '    '): string => {
    const rnStyleObjectToString = (style?: React.CSSProperties): string => {
      if (!style || Object.keys(style).length === 0) return '{}';
      const rnStyle: Record<string, any> = {};
      for (const [key, value] of Object.entries(style)) {
        if (key === 'fontSize' && typeof value === 'string' && value.endsWith('px')) {
          rnStyle[key] = parseInt(value, 10);
        } else if (key === 'backgroundColor' || key === 'color' || key === 'padding' || key === 'margin' || key === 'width' || key === 'height' || key === 'opacity' || key === 'borderRadius' || key === 'fontWeight' || key === 'textAlign') {
            // Ces propriétés sont souvent similaires ou directes
            if (typeof value === 'string' && value.endsWith('px') && (key === 'padding' || key === 'margin' || key === 'width' || key === 'height' || key === 'borderRadius')) {
                 // Pour RN, on utilise des nombres pour les dimensions, padding, margin, borderRadius
                const numValue = parseInt(value, 10);
                if (!isNaN(numValue)) rnStyle[key] = numValue;
            } else {
                 rnStyle[key] = value;
            }
        }
        // Ajouter d'autres conversions spécifiques à RN ici
      }
      return JSON.stringify(rnStyle, null, 2).replace(/"([^"]+)":/g, '$1:');
    };
  
    let rnComponent = 'View';
    let propsString = `style={${rnStyleObjectToString(element.style)}}`;
    let children = `<Text>${element.content}</Text>`; // Par défaut, mettre le contenu dans un Text

    switch (element.type) {
      case 'text':
        rnComponent = 'Text';
        children = element.content;
        break;
      case 'button': // Un bouton RN plus personnalisable
        rnComponent = 'TouchableOpacity';
        // Style du TouchableOpacity pourrait être différent de celui du Text interne
        children = `<Text style={{color: ${element.style?.color ? `'${element.style.color}'` : "'#FFFFFF'"}, textAlign: 'center'}}>${element.content}</Text>`;
        break;
      case 'image':
        rnComponent = 'Image';
        propsString += ` source={{ uri: "${element.properties.src || ''}" }}`;
        // Pour RN, Image a un style séparé pour les dimensions.
        // On pourrait extraire width/height du style général et les mettre ici si besoin.
        // Exemple: style.width et style.height devraient être des nombres.
        children = '';
        break;
      case 'richtext': // Pas d'équivalent direct simple à `dangerouslySetInnerHTML`
        rnComponent = 'View'; // Ou utiliser une lib tierce pour rendre du HTML
        children = `<Text>Rich text content (HTML non rendu): ${element.content.replace(/<[^>]*>?/gm, '')}</Text>`; // Version simplifiée
        break;
      // Ajouter d'autres cas pour checkbox, switch etc. avec les composants RN correspondants
    }
  
    return `${indent}<${rnComponent} ${propsString}>${children ? `\n${indent}  ${children}\n${indent}` : ''}</${rnComponent}>`;
  };

  const handleExport = () => {
    let codeContent = '';
    let finalCode = '';
    const imports: Set<string> = new Set(); // Pour gérer les imports React Native

    if (exportOptions.format === 'react') {
        codeContent = screenElements.map(el => elementToReact(el)).join('\n');
        finalCode = `import React from 'react';\n\nconst MyScreen = () => {\n  return (\n    <>\n${codeContent}\n    </>\n  );\n};\n\nexport default MyScreen;`;
    } else if (exportOptions.format === 'react-native') {
        imports.add('React');
        const componentBodies = screenElements.map(el => {
            // Ajouter les imports nécessaires en fonction du type d'élément RN
            if (el.type === 'text' || el.type === 'richtext') imports.add('Text');
            if (el.type === 'button') imports.add('TouchableOpacity');
            if (el.type === 'image') imports.add('Image');
            if (el.type === 'container' || el.type === 'row' || el.type === 'column' || el.type === 'card' || el.type === 'richtext' || el.type === 'icon' || el.type === 'checkbox' || el.type === 'switch' || el.type === 'toggle' || el.type === 'form' || el.type === 'carousel' || el.type === 'datatable') imports.add('View');
            // ... ajouter d'autres imports pour Switch, Checkbox etc.

            return elementToReactNative(el);
        }).join('\n');
        
        const rnImportsString = `import ${Array.from(imports).join(', ')} from 'react';\nimport { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';\n/* Assurez-vous d'importer tous les composants utilisés ci-dessus (ex: Switch, Checkbox) */\n\n`;

        // Très basique, ne génère pas de StyleSheet dynamique à partir des styles individuels.
        // Il faudrait agréger tous les styles uniques dans un StyleSheet.
        finalCode = `${rnImportsString}const MyScreen = () => {\n  return (\n    <View style={styles.container}>\n${componentBodies}\n    </View>\n  );\n};\n\nconst styles = StyleSheet.create({\n  container: {\n    flex: 1,\n    padding: 10,\n    // backgroundColor: '#fff', // Exemple\n  },\n  // ... les styles des éléments individuels devraient être ici\n});\n\nexport default MyScreen;`;
    } else { // HTML
        codeContent = screenElements.map(el => elementToHTML(el, '    ')).join('\n');
        finalCode = `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Exported Screen</title>\n  <!-- Si vous utilisez des classes Tailwind dans vos styles, incluez Tailwind CSS ici -->\n  <!-- <script src="https://cdn.tailwindcss.com"></script> -->\n  <style>\n    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; margin: 0; padding: 20px; background-color: #f0f0f0; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }\n    .mobile-screen-preview { width: 320px; /* Un peu plus large pour le padding */ border: 1px solid #ccc; padding: 10px; background-color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }\n    /* Ajoutez ici des styles CSS globaux si nécessaire */\n  </style>\n</head>\n<body>\n  <div class="mobile-screen-preview">\n${codeContent}\n  </div>\n</body>\n</html>`;
    }
    setExportedCode(finalCode);
  };
  
  const copyToClipboard = () => {
    if (!exportedCode) {
        alert("Générez d'abord le code !");
        return;
    }
    navigator.clipboard.writeText(exportedCode).then(() => {
        alert('Code copié dans le presse-papiers !');
    }).catch(err => {
        console.error('Erreur lors de la copie: ', err);
        alert('Erreur lors de la copie.');
    });
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-base font-semibold text-gray-800 border-b pb-2">Exporter le Code</h3>
      <div className="flex space-x-2 mb-2">
        {(['html', 'react', 'react-native'] as const).map(format => (
            <button
                key={format}
                onClick={() => setExportOptions({ format })}
                className={`px-3 py-1.5 text-xs rounded-md font-medium flex items-center justify-center
                    ${exportOptions.format === format 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
                {format === 'html' && <CodeIcon size={14} className="inline mr-1.5"/>}
                {format === 'react' && <Smartphone size={14} className="inline mr-1.5"/>}
                {format === 'react-native' && <TabletSmartphone size={14} className="inline mr-1.5"/>}
                {format.toUpperCase()}
            </button>
        ))}
      </div>
      <button
        onClick={handleExport}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md text-sm"
      >
        Générer le code ({exportOptions.format.toUpperCase()})
      </button>
      {exportedCode && (
        <div className="mt-3">
            <div className="flex justify-between items-center mb-1">
                <p className="text-xs text-gray-600">Code généré :</p>
                <button 
                    onClick={copyToClipboard} 
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md flex items-center"
                >
                    <ClipboardCopy size={12} className="mr-1"/> Copier
                </button>
            </div>
          <textarea
            readOnly
            value={exportedCode}
            rows={10} // Ajuste la hauteur
            className="w-full p-2 border border-gray-300 rounded-md text-xs font-mono bg-gray-50 resize-y"
            placeholder="Le code généré apparaîtra ici..."
          />
        </div>
      )}
    </div>
  );
};


const Design: React.FC = () => { 
    const [screenElements, setScreenElements] = useState<ScreenElementType[]>([]); 
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const addElementToScreen = (type: string, name: string, defaultContent: string) => { 
    const newElement: ScreenElementType = { 
      id: Date.now().toString(),
      type: type,
      name: name,
      content: defaultContent, 
      properties: {},
      style: {}, 
    };

    if (type === 'image' || type === 'circleimage') {
        newElement.properties.src = ''; 
        newElement.properties.alt = name; 
    }
    if (type === 'gridview') {
        newElement.properties.items = [
            { id: 'g1', color: 'bg-red-200', text: 'Item 1' }, { id: 'g2', color: 'bg-blue-200', text: 'Item 2' },
            { id: 'g3', color: 'bg-green-200', text: 'Item 3' },{ id: 'g4', color: 'bg-yellow-200', text: 'Item 4' },
        ];
        newElement.content = ""; 
    }
    if (type === 'listview') {
        newElement.properties.items = [ { id: 'l1', text: 'List Item A' }, { id: 'l2', text: 'List Item B' }, { id: 'l3', text: 'List Item C' }, ];
        newElement.content = ""; 
    }
    if (type === 'checkbox' || type === 'switch' || type === 'toggle') {
        newElement.properties.checked = false;
    }
    
    newElement.style = { padding: '4px', margin: '2px 0' }; 
    if (type === 'text') newElement.style = { ...newElement.style, color: '#333333', fontSize: '14px' };
    if (type === 'button') newElement.style = { ...newElement.style, backgroundColor: '#3b82f6', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', textAlign: 'center' };
    if (type === 'card') newElement.style = { ...newElement.style, backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
    if (type === 'container') newElement.style = { ...newElement.style, backgroundColor: '#e5e7eb', minHeight: '50px' };

    setScreenElements(prevElements => [...prevElements, newElement]);
    setSelectedElementId(newElement.id); 
  };

  const updateElement = (id: string, newProps: Partial<ScreenElementType>) => {
    setScreenElements(prevElements => 
        prevElements.map(el => 
            el.id === id ? { ...el, ...newProps } : el
        )
    );
  };

  const currentSelectedElement = screenElements.find(el => el.id === selectedElementId) || null;

  return (
    <div style={{fontFamily: "Funnel Display, sans-serif"}} className='h-screen w-full flex'>
        <Sidebar onAddComponent={addElementToScreen} />
        
        <div className="flex-grow bg-[#fafafa] flex items-center justify-center p-4 overflow-hidden"> 
            <div 
                className="h-[550px] fixed z-[999] w-[300px] top-[10%] bg-[#000] rounded-[40px] border-[7px] border-[#0A0A0A] ring ring-[#222] shadow-xl flex flex-col overflow-hidden"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        setSelectedElementId(null);
                    }
                }}
            > 
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

                <div className="absolute top-0 w-full left-0 flex items-center justify-center pt-[5px]"> 
                    <div className="relative h-[30px]  w-[100px] z-[9999] rounded-b-[20px] bg-[#0A0A0A]"></div>
                </div>
            
                <div className="mt-[40px] flex-grow w-full bg-black rounded-b-[34px] p-[1px] overflow-hidden"> 
                    <div className='h-full w-full bg-gray-100 rounded-[33px] p-2 overflow-y-auto space-y-1'> 
                        {screenElements.length === 0 && (
                            <div className="flex items-center justify-center h-full text-gray-400 text-xs px-4 text-center">
                                Cliquez sur un élément dans la sidebar pour l'ajouter sur l'écran.
                            </div>
                        )}
                        {screenElements.map(element => ( 
                            <ScreenElement
                                key={element.id}
                                {...element} 
                                properties={element.properties || {}} 
                                isSelected={selectedElementId === element.id}
                                onSelect={setSelectedElementId}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
        <div className="h-full w-[20%] bg-[#FFF] border-l border-gray-200 overflow-y-auto flex flex-col">
             <div className="flex-grow">
                <PropertiesPanel 
                    selectedElement={currentSelectedElement}
                    onUpdateElement={updateElement}
                />
             </div>
             <div className="border-t border-gray-200">
                <ExportPanel screenElements={screenElements} />
             </div>
        </div>
    </div>
  )
}

export default Design;
