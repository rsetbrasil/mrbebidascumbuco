import React, { useState, useMemo } from 'react';
import { format, parse, isValid, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DateInput = ({ value, onChange, labelPrefix, style }) => {
    const [open, setOpen] = useState(false);
    const baseDate = value ? new Date(value + 'T00:00:00') : new Date();
    const [viewDate, setViewDate] = useState(baseDate);

    const displayValue = value ? format(new Date(value + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '';

    const gridDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
        const days = [];
        let curr = start;
        while (curr <= end) {
            days.push(curr);
            curr = addDays(curr, 1);
        }
        return days;
    }, [viewDate]);

    const handleSelect = (date) => {
        const iso = format(date, 'yyyy-MM-dd');
        onChange && onChange(iso);
        setOpen(false);
    };

    const handleInputChange = (e) => {
        const txt = e.target.value;
        const parsed = parse(txt, 'dd/MM/yyyy', new Date());
        if (isValid(parsed)) {
            const iso = format(parsed, 'yyyy-MM-dd');
            onChange && onChange(iso);
            setViewDate(parsed);
        }
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {labelPrefix && (
                <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    {labelPrefix} {value ? `(${format(new Date(value + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })})` : ''}
                </label>
            )}
            <input
                type="text"
                value={displayValue}
                onChange={handleInputChange}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
                style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    outline: 'none',
                    fontSize: 'var(--font-size-md)',
                    fontWeight: 600,
                    letterSpacing: '0.3px',
                    minWidth: '170px',
                    textAlign: 'center',
                    ...style
                }}
            />
            {open && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        background: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '8px',
                        zIndex: 50,
                        width: 280,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
                    }}
                    onMouseLeave={() => setOpen(false)}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <button
                            onClick={() => setViewDate(subMonths(viewDate, 1))}
                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                        >
                            ‹
                        </button>
                        <div style={{ fontWeight: 700 }}>
                            {format(viewDate, 'LLLL yyyy', { locale: ptBR })}
                        </div>
                        <button
                            onClick={() => setViewDate(addMonths(viewDate, 1))}
                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                        >
                            ›
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((w) => (
                            <div key={w} style={{ textAlign: 'center' }}>{w}</div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                        {gridDays.map((d) => {
                            const inactive = !isSameMonth(d, viewDate);
                            const selected = value ? isSameDay(new Date(value + 'T00:00:00'), d) : false;
                            return (
                                <button
                                    key={d.getTime()}
                                    onClick={() => handleSelect(d)}
                                    style={{
                                        padding: '8px 0',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        background: selected ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                                        color: selected ? '#fff' : (inactive ? 'var(--color-text-muted)' : 'var(--color-text-primary)'),
                                        fontWeight: 600
                                    }}
                                >
                                    {format(d, 'd', { locale: ptBR })}
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                        <button
                            onClick={() => { const t = new Date(); onChange && onChange(format(t, 'yyyy-MM-dd')); setViewDate(t); }}
                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', fontWeight: 600 }}
                        >
                            Hoje
                        </button>
                        <button
                            onClick={() => setOpen(false)}
                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateInput;
