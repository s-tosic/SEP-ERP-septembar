import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DataTable from '../components/DataTable.vue';

describe('DataTable.vue - Reusable Generic Table Component', () => {
  const sampleColumns = [
    { key: 'code', label: 'Šifra', sortable: true },
    { key: 'city', label: 'Grad', sortable: true },
  ];

  const sampleItems = [
    { id: 1, code: 'WH-BG-01', city: 'Beograd' },
    { id: 2, code: 'WH-NI-01', city: 'Niš' },
    { id: 3, code: 'WH-VS-01', city: 'Vršac' },
  ];

  it('ispravno renderuje sve redove i kolone', () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: sampleColumns,
        items: sampleItems,
      },
    });

    expect(wrapper.text()).toContain('Beograd');
    expect(wrapper.text()).toContain('Niš');
    expect(wrapper.text()).toContain('Vršac');
    expect(wrapper.text()).toContain('Prikazano 3 od ukupno 3 zapisa');
  });

  it('filtrira podatke kroz pretragu (Live Search)', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: sampleColumns,
        items: sampleItems,
      },
    });

    const searchInput = wrapper.find('input[type="text"]');
    await searchInput.setValue('Vršac');

    expect(wrapper.text()).toContain('Vršac');
    expect(wrapper.text()).not.toContain('Beograd');
    expect(wrapper.text()).not.toContain('Niš');
    expect(wrapper.text()).toContain('Prikazano 1 od ukupno 3 zapisa');
  });

  it('prikazuje poruku kada nema podataka za prikaz', () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: sampleColumns,
        items: [],
      },
    });

    expect(wrapper.text()).toContain('Nema podataka za prikaz');
  });
});
