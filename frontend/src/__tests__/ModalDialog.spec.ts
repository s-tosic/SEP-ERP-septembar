import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ModalDialog from '../components/ModalDialog.vue';

describe('ModalDialog.vue - Reusable Bootstrap Modal Component', () => {
  it('ne renderuje se na ekranu kada je show: false', () => {
    const wrapper = mount(ModalDialog, {
      props: {
        show: false,
        title: 'Testni Modal',
      },
    });

    expect(wrapper.find('.modal').exists()).toBe(false);
  });

  it('renderuje naslov i sadržaj kada je show: true', () => {
    const wrapper = mount(ModalDialog, {
      props: {
        show: true,
        title: 'Kreiranje Skladišta',
      },
      slots: {
        default: '<div id="test-content">Sadržaj forme</div>',
      },
    });

    expect(wrapper.find('.modal').exists()).toBe(true);
    expect(wrapper.text()).toContain('Kreiranje Skladišta');
    expect(wrapper.find('#test-content').text()).toBe('Sadržaj forme');
  });

  it('emituje submit događaj kada se klikne na dugme za čuvanje', async () => {
    const wrapper = mount(ModalDialog, {
      props: {
        show: true,
        title: 'Test Modal',
        submitLabel: 'Potvrdi',
      },
    });

    const submitBtn = wrapper.findAll('button').find((b) => b.text().includes('Potvrdi'));
    expect(submitBtn).toBeDefined();
    await submitBtn!.trigger('click');

    expect(wrapper.emitted()).toHaveProperty('submit');
  });
});
