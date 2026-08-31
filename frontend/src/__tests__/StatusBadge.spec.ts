import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusBadge from '../components/StatusBadge.vue';

describe('StatusBadge.vue - SAP MM Movement & Stock Badges', () => {
  it('ispravno prikazuje bedž za SAP 101 PRIJEM (INBOUND)', () => {
    const wrapper = mount(StatusBadge, {
      props: {
        type: 'movement',
        value: '101_INBOUND',
      },
    });

    expect(wrapper.text()).toContain('101 | PRIJEM (ULAZ)');
    expect(wrapper.classes()).toContain('bg-success');
  });

  it('ispravno prikazuje bedž za SAP 201 OTPREMU (OUTBOUND)', () => {
    const wrapper = mount(StatusBadge, {
      props: {
        type: 'movement',
        value: '201_OUTBOUND',
      },
    });

    expect(wrapper.text()).toContain('201 | OTPREMA (IZLAZ)');
    expect(wrapper.classes()).toContain('bg-primary');
  });

  it('ispravno prikazuje bedž za SAP 551 RASHOD (SCRAP)', () => {
    const wrapper = mount(StatusBadge, {
      props: {
        type: 'movement',
        value: '551_SCRAP',
      },
    });

    expect(wrapper.text()).toContain('551 | OTPIS (RASHOD)');
    expect(wrapper.classes()).toContain('bg-danger');
  });

  it('ispravno prikazuje bedž za OPTIMALNO stanje zaliha', () => {
    const wrapper = mount(StatusBadge, {
      props: {
        type: 'stock',
        value: 'OPTIMALNO',
      },
    });

    expect(wrapper.text()).toContain('Optimalno');
    expect(wrapper.classes()).toContain('bg-success');
  });

  it('ispravno prikazuje bedž za KRITIČNO stanje zaliha', () => {
    const wrapper = mount(StatusBadge, {
      props: {
        type: 'stock',
        value: 'KRITIČNO',
      },
    });

    expect(wrapper.text()).toContain('Kritična zaliha');
    expect(wrapper.classes()).toContain('bg-warning');
  });
});
