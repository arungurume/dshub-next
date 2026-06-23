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
}

const CustomSelect = forwardRef<HTMLSelectElement, CustomSelectProps>(
  ({ options, placeholder, className, wrapperClassName, value, onChange, disabled, ...rest }, ref) => {
    const [isOpen, setIsOpen] = useState(false);

    // Internal state for uncontrolled usage, synced with 'value' if controlled
    const [internalValue, setInternalValue] = useState<string | number>('');

    // Portal menu position
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

    const containerRef = useRef<HTMLDivElement>(null);
    const nativeSelectRef = useRef<HTMLSelectElement | null>(null);

    // Sync external value to internal
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value as string | number);
      }
    }, [value]);

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
          // Also check if click was inside the portal menu
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

      // If we have a native select, update its value and dispatch a change event so RHF catches it
      if (nativeSelectRef.current) {
        nativeSelectRef.current.value = String(optionValue);
        const event = new Event('change', { bubbles: true });
        nativeSelectRef.current.dispatchEvent(event);
      }

      // Also call standard onChange if passed directly
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

    const menuContent = (
      <div
        id="custom-select-portal-menu"
        className="custom-select-menu"
        style={menuStyle}
      >
        {placeholder && (
          <div
            className={`custom-select-option ${internalValue === '' ? 'selected' : ''}`}
            onClick={() => handleSelect('')}
          >
            <span className="placeholder-text">{placeholder}</span>
          </div>
        )}
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`custom-select-option ${String(opt.value) === String(internalValue) ? 'selected' : ''}`}
            onClick={() => handleSelect(opt.value)}
          >
            <span>{opt.label}</span>
            {String(opt.value) === String(internalValue) && <Check size={14} className="check-icon" />}
          </div>
        ))}
      </div>
    );

    return (
      <div className={`custom-select-wrapper ${wrapperClassName || ''}`} ref={containerRef}>
        {/* Hidden native select for form libraries like react-hook-form */}
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

        {/* Custom UI trigger */}
        <div
          className={`custom-select-control ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className || ''}`}
          onClick={handleToggle}
        >
          <span className={`custom-select-value ${!selectedOption && placeholder ? 'placeholder' : ''}`}>
            {displayLabel}
          </span>
          <ChevronDown size={14} className={`custom-select-icon ${isOpen ? 'rotate' : ''}`} />
        </div>

        {/* Portal menu — rendered in body to escape overflow:hidden ancestors */}
        {isOpen && typeof document !== 'undefined' && createPortal(menuContent, document.body)}
      </div>
    );
  }
);

CustomSelect.displayName = 'CustomSelect';
export default CustomSelect;
