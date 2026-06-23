import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface CustomSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
  placeholder?: string;
  wrapperClassName?: string;
  searchable?: boolean;
}

const CustomSelect = forwardRef<HTMLSelectElement, CustomSelectProps>(
  ({ options, placeholder, className, wrapperClassName, value, onChange, disabled, searchable, ...rest }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [internalValue, setInternalValue] = useState<string | number>('');
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const [searchTerm, setSearchTerm] = useState('');

    const containerRef = useRef<HTMLDivElement>(null);
    const nativeSelectRef = useRef<HTMLSelectElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sync external value to internal
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value as string | number);
      }
    }, [value]);

    // Clear search term when menu closes
    useEffect(() => {
      if (!isOpen) {
        setSearchTerm('');
      }
    }, [isOpen]);

    const isSearchEnabled = searchable ?? (options.length > 8);

    // Autofocus search input when menu opens
    useEffect(() => {
      if (isOpen && isSearchEnabled) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }, [isOpen, isSearchEnabled]);

    // Calculate menu position from the trigger rect
    function updateMenuPosition() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 99999,
      });
    }

    // Open/close and reposition
    function handleToggle() {
      if (disabled) return;
      if (!isOpen) {
        updateMenuPosition();
      }
      setIsOpen(prev => !prev);
    }

    // Close on outside click
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          const menu = document.getElementById('custom-select-portal-menu');
          if (menu && menu.contains(event.target as Node)) return;
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Update position on scroll or resize
    useEffect(() => {
      if (!isOpen) return;
      const handleUpdate = () => {
        updateMenuPosition();
      };
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);
      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
      };
    }, [isOpen]);

    // Combine refs to support both RHF and our internal needs
    const setRefs = (element: HTMLSelectElement) => {
      nativeSelectRef.current = element;
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLSelectElement>).current = element;
      }
    };

    const handleSelect = (optionValue: string | number) => {
      setInternalValue(optionValue);
      setIsOpen(false);

      if (nativeSelectRef.current) {
        nativeSelectRef.current.value = String(optionValue);
        const event = new Event('change', { bubbles: true });
        nativeSelectRef.current.dispatchEvent(event);
      }

      if (onChange) {
        const e = {
          target: { value: String(optionValue), name: rest.name },
          currentTarget: { value: String(optionValue), name: rest.name }
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(e);
      }
    };

    const selectedOption = options.find(o => String(o.value) === String(internalValue));
    const displayLabel = selectedOption ? selectedOption.label : (placeholder || 'Select...');

    const filteredOptions = options.filter(opt =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const menuContent = (
      <div
        id="custom-select-portal-menu"
        className="custom-select-menu"
        style={{
          ...menuStyle,
          maxHeight: 'none',
          overflowY: 'visible',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isSearchEnabled && (
          <div className="custom-select-search-wrap" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="custom-select-search-input"
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--input-bg, rgba(0,0,0,0.02))',
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}
        <div className="custom-select-options-list" style={{ maxHeight: '200px', overflowY: 'auto', overflowX: 'hidden', padding: '0.125rem' }}>
          {placeholder && !searchTerm && (
            <div
              className={`custom-select-option ${internalValue === '' ? 'selected' : ''}`}
              onClick={() => handleSelect('')}
            >
              <span className="placeholder-text">{placeholder}</span>
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              No options found
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                className={`custom-select-option ${String(opt.value) === String(internalValue) ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                <span>{opt.label}</span>
                {String(opt.value) === String(internalValue) && <Check size={14} className="check-icon" />}
              </div>
            ))
          )}
        </div>
      </div>
    );

    return (
      <div className={`custom-select-wrapper ${wrapperClassName || ''}`} ref={containerRef}>
        <select
          ref={setRefs}
          value={internalValue}
          onChange={(e) => {
            setInternalValue(e.target.value);
            if (onChange) onChange(e);
          }}
          className="hidden-native-select"
          style={{ display: 'none' }}
          disabled={disabled}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div
          className={`custom-select-control ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className || ''}`}
          onClick={handleToggle}
        >
          <span className={`custom-select-value ${!selectedOption && placeholder ? 'placeholder' : ''}`}>
            {displayLabel}
          </span>
          <ChevronDown size={14} className={`custom-select-icon ${isOpen ? 'rotate' : ''}`} />
        </div>

        {isOpen && typeof document !== 'undefined' && createPortal(menuContent, document.body)}
      </div>
    );
  }
);

CustomSelect.displayName = 'CustomSelect';
export default CustomSelect;
