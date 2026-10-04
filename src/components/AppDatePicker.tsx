import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

interface AppDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

const isoToPtBr = (iso: string): string => {
  if (!iso || !iso.includes('-')) return iso;
  const [y, m, d] = iso.split('-');
  if (y && m && d) {
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return iso;
};

const ptBrToIso = (text: string): string | null => {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 8) {
    const day = parseInt(digits.slice(0, 2), 10);
    const month = parseInt(digits.slice(2, 4), 10);
    const year = parseInt(digits.slice(4, 8), 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
};

export const AppDatePicker: React.FC<AppDatePickerProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'DD/MM/AAAA',
  required = false
}) => {
  const [dateText, setDateText] = useState(() => isoToPtBr(value));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState<number>(() => {
    if (value && value.includes('-')) return parseInt(value.split('-')[0], 10);
    return new Date().getFullYear();
  });
  const [calendarMonth, setCalendarMonth] = useState<number>(() => {
    if (value && value.includes('-')) return parseInt(value.split('-')[1], 10) - 1;
    return new Date().getMonth();
  });
  const [selectedTempDate, setSelectedTempDate] = useState<string>(value || new Date().toISOString().split('T')[0]);

  React.useEffect(() => {
    if (value) {
      setDateText(isoToPtBr(value));
      setSelectedTempDate(value);
    }
  }, [value]);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDateText(raw);
    const iso = ptBrToIso(raw);
    if (iso) {
      onChange(iso);
    }
  };

  const openCalendar = () => {
    const current = value || new Date().toISOString().split('T')[0];
    if (current && current.includes('-')) {
      const [y, m] = current.split('-');
      setCalendarYear(parseInt(y, 10));
      setCalendarMonth(parseInt(m, 10) - 1);
      setSelectedTempDate(current);
    }
    setIsCalendarOpen(true);
  };

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        value={dateText}
        onChange={handleTextChange}
        placeholder={placeholder}
        maxLength={10}
        required={required}
        className={className || "w-full pl-3 pr-10 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:bg-white"}
      />
      <button
        type="button"
        onClick={openCalendar}
        className="absolute right-2 p-1.5 bg-gray-200 hover:bg-[#D4AF37] text-gray-700 hover:text-[#121212] rounded-lg transition cursor-pointer"
        title="Abrir calendário"
      >
        <Calendar className="w-3.5 h-3.5" />
      </button>

      {/* Custom App-Styled Calendar Modal */}
      {isCalendarOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#161616] border border-gray-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-6 text-white">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">Calendário do App</span>
                <h3 className="text-base font-black text-white">Selecionar Data</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalendarOpen(false)}
                className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Month / Year Switcher */}
            <div className="flex items-center justify-between bg-[#222] border border-gray-700/80 rounded-2xl p-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 text-[#D4AF37] hover:bg-white/5 rounded-xl transition cursor-pointer font-bold"
              >
                ◀
              </button>
              <span className="text-sm font-black text-white font-serif">
                {monthNames[calendarMonth]} de {calendarYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 text-[#D4AF37] hover:bg-white/5 rounded-xl transition cursor-pointer font-bold"
              >
                ▶
              </button>
            </div>

            {/* Weekdays Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-gray-400">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((wd, i) => (
                <div key={i} className="py-1">{wd}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {(() => {
                const totalDays = getDaysInMonth(calendarYear, calendarMonth);
                const firstDay = getFirstDayOfMonth(calendarYear, calendarMonth);
                const cells = [];

                for (let i = 0; i < firstDay; i++) {
                  cells.push(<div key={`empty-${i}`} />);
                }

                for (let day = 1; day <= totalDays; day++) {
                  const mStr = String(calendarMonth + 1).padStart(2, '0');
                  const dStr = String(day).padStart(2, '0');
                  const isoStr = `${calendarYear}-${mStr}-${dStr}`;
                  const isSelected = selectedTempDate === isoStr;
                  const isToday = new Date().toISOString().split('T')[0] === isoStr;

                  cells.push(
                    <button
                      key={isoStr}
                      type="button"
                      onClick={() => setSelectedTempDate(isoStr)}
                      className={`py-2.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? 'bg-[#D4AF37] text-[#121212] shadow-lg shadow-amber-500/20 scale-105'
                          : isToday
                          ? 'border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-white/5'
                          : 'text-gray-200 hover:bg-white/10'
                      }`}
                    >
                      {day}
                    </button>
                  );
                }
                return cells;
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setIsCalendarOpen(false)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(selectedTempDate);
                  setDateText(isoToPtBr(selectedTempDate));
                  setIsCalendarOpen(false);
                }}
                className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#c29f31] text-[#121212] font-black rounded-xl text-xs uppercase tracking-wider transition shadow-lg cursor-pointer"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
