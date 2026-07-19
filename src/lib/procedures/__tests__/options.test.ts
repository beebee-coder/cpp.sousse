import { describe, it, expect } from 'vitest';
import { normalizeTemplateOptions, renderTemplateOptions } from '../options';

describe('procedures/options helpers', () => {
  it('normalizeTemplateOptions: null/undefined → null', () => {
    expect(normalizeTemplateOptions(null)).toBeNull();
    expect(normalizeTemplateOptions(undefined)).toBeNull();
  });

  it('normalizeTemplateOptions: string[] conservé', () => {
    expect(normalizeTemplateOptions(['A', 'B'])).toEqual(['A', 'B']);
  });

  it('normalizeTemplateOptions: multiline string → string[]', () => {
    expect(normalizeTemplateOptions('Ouvert\nFermé\n')).toEqual(['Ouvert', 'Fermé']);
  });

  it('normalizeTemplateOptions: objets {value,label} → values', () => {
    expect(normalizeTemplateOptions([{ value: 'x', label: 'X' }, { value: 'y' }])).toEqual(['x', 'y']);
  });

  it('renderTemplateOptions: mappe en {value,label}', () => {
    expect(renderTemplateOptions(['A', 'B'])).toEqual([{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]);
    expect(renderTemplateOptions(null)).toEqual([]);
  });
});
