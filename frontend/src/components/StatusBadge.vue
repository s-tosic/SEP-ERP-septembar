<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  type?: 'movement' | 'stock' | 'active';
  value: any;
}>();

const badgeInfo = computed(() => {
  if (props.type === 'movement') {
    if (props.value === '101_INBOUND' || props.value === 'INBOUND') {
      return { class: 'bg-success text-white', label: '101 | PRIJEM (ULAZ)', icon: 'bi-arrow-down-left' };
    }
    if (props.value === '201_OUTBOUND' || props.value === 'OUTBOUND') {
      return { class: 'bg-primary text-white', label: '201 | OTPREMA (IZLAZ)', icon: 'bi-arrow-up-right' };
    }
    if (props.value === '551_SCRAP') {
      return { class: 'bg-danger text-white', label: '551 | OTPIS (RASHOD)', icon: 'bi-trash' };
    }
    if (props.value === '301_TRANSFER' || props.value === '301_TRANSFER_OUT') {
      return { class: 'bg-warning text-dark', label: '301 | PRENOS (IZLAZ)', icon: 'bi-arrow-left-right' };
    }
    if (props.value === '301_TRANSFER_IN') {
      return { class: 'bg-info text-dark', label: '301 | PRENOS (ULAZ)', icon: 'bi-arrow-left-right' };
    }
    return { class: 'bg-secondary text-white', label: String(props.value), icon: '' };
  }

  if (props.type === 'stock') {
    if (props.value === 'OPTIMALNO') {
      return { class: 'bg-success text-white', label: 'Optimalno', icon: 'bi-check-circle' };
    }
    if (props.value === 'KRITIČNO') {
      return { class: 'bg-warning text-dark', label: 'Kritična zaliha', icon: 'bi-exclamation-triangle' };
    }
    return { class: 'bg-danger text-white', label: 'Nema na stanju', icon: 'bi-x-circle' };
  }

  if (props.type === 'active') {
    if (props.value === true || props.value === 1) {
      return { class: 'bg-success-subtle text-success border border-success-subtle', label: 'Aktivno', icon: 'bi-dot' };
    }
    return { class: 'bg-secondary-subtle text-secondary border border-secondary-subtle', label: 'Neaktivno', icon: 'bi-dash' };
  }

  return { class: 'bg-secondary text-white', label: String(props.value), icon: '' };
});
</script>

<template>
  <span class="badge d-inline-flex align-items-center py-1 px-2 fw-medium" :class="badgeInfo.class">
    <i v-if="badgeInfo.icon" class="bi me-1" :class="badgeInfo.icon"></i>
    {{ badgeInfo.label }}
  </span>
</template>
