import { describe, it, expect } from 'vitest';
import { pickActiveRegisterForTerminal } from '../services/firestore';

const mk = (id, terminalId, ts) => ({
  id,
  terminalId,
  status: 'open',
  openedAt: new Date(ts)
});

describe('pickActiveRegisterForTerminal', () => {
  it('seleciona o único caixa aberto', () => {
    const regs = [mk('A', 'T1', '2024-01-01T10:00:00Z')];
    const res = pickActiveRegisterForTerminal(regs, 'T1');
    expect(res && res.id).toBe('A');
  });

  it('prioriza caixa do terminal quando existem múltiplos abertos', () => {
    const regs = [
      mk('A', 'T1', '2024-01-01T10:00:00Z'),
      mk('B', 'T2', '2024-01-01T12:00:00Z')
    ];
    const res = pickActiveRegisterForTerminal(regs, 'T1');
    expect(res && res.id).toBe('A');
  });

  it('quando não há caixa do terminal, escolhe o mais recente entre abertos', () => {
    const regs = [
      mk('A', 'T1', '2024-01-01T10:00:00Z'),
      mk('B', 'T2', '2024-01-01T12:00:00Z'),
      mk('C', 'T3', '2024-01-01T14:00:00Z')
    ];
    const res = pickActiveRegisterForTerminal(regs, 'T9');
    expect(res && res.id).toBe('C');
  });

  it('com dois caixas do mesmo terminal, escolhe o mais recente', () => {
    const regs = [
      mk('A', 'T1', '2024-01-01T10:00:00Z'),
      mk('B', 'T1', '2024-01-01T12:00:00Z'),
      mk('C', 'T2', '2024-01-01T13:00:00Z')
    ];
    const res = pickActiveRegisterForTerminal(regs, 'T1');
    expect(res && res.id).toBe('B');
  });

  it('retorna null se não há caixas abertos', () => {
    const regs = [];
    const res = pickActiveRegisterForTerminal(regs, 'T1');
    expect(res).toBeNull();
  });
});

