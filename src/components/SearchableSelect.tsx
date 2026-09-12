import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  allowCustomInput?: boolean;
  id?: string;
  required?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Selecione uma opção',
  searchPlaceholder = 'Pesquisar...',
  emptyText = 'Nenhum resultado encontrado',
  icon,
  disabled = false,
  allowCustomInput = false,
  id,
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Filter options based on search query
  const cleanSearch = searchTerm.trim().toLowerCase();
  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(cleanSearch) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(cleanSearch)) ||
      opt.value.toLowerCase().includes(cleanSearch)
  );

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value || '';

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCustomUse = () => {
    if (allowCustomInput && searchTerm.trim()) {
      onChange(searchTerm.trim());
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef} id={id ? `${id}-container` : undefined}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-h-[48px] px-3.5 py-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-2 transition text-left cursor-pointer ${
          disabled
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-[#D4AF37] ring-2 ring-[#D4AF37]/30 shadow-xs'
            : value
            ? 'bg-white border-gray-300 text-[#121212]'
            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-white hover:border-gray-300'
        }`}
        id={id}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {icon && <span className="shrink-0 text-[#D4AF37]">{icon}</span>}
          <span className={`truncate font-medium ${value ? 'text-[#121212] font-semibold' : 'text-gray-400'}`}>
            {displayLabel || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-gray-400">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 hover:text-gray-600 rounded-md transition"
              title="Limpar seleção"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#D4AF37]' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-64">
          {/* Search Bar Input */}
          <div className="p-2 border-b border-gray-100 bg-gray-50/70 sticky top-0 z-10">
            <div className="relative">
              <Search className="w-4 h-4 text-[#D4AF37] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredOptions.length > 0) {
                      handleSelect(filteredOptions[0].value);
                    } else if (allowCustomInput && searchTerm.trim()) {
                      handleCustomUse();
                    }
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-[#121212] placeholder-gray-400 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 p-1 divide-y divide-gray-50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50 text-[#121212] font-bold'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[10px] text-gray-400 truncate">{opt.sublabel}</span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#D4AF37] shrink-0 stroke-[2.5]" />}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500">{emptyText}</p>
                {allowCustomInput && searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={handleCustomUse}
                    className="mt-2 px-3 py-1.5 bg-[#121212] hover:bg-black text-[#D4AF37] font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    Usar "{searchTerm.trim()}"
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
