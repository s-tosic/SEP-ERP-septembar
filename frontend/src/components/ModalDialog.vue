<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    show: boolean;
    title: string;
    submitLabel?: string;
    submitVariant?: string;
    isSubmitting?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    closeOnClickOutside?: boolean;
  }>(),
  {
    closeOnClickOutside: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit'): void;
}>();

function handleBackdropClick() {
  if (props.closeOnClickOutside && !props.isSubmitting) {
    emit('close');
  }
}

// Zatvaranje modala pritiskom na taster Escape (Esc)
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show && !props.isSubmitting) {
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div
    v-if="show"
    class="modal fade show d-block"
    tabindex="-1"
    style="background-color: rgba(0, 0, 0, 0.5)"
    @click.self="handleBackdropClick"
  >
    <div
      class="modal-dialog modal-dialog-centered"
      :class="{
        'modal-sm': size === 'sm',
        'modal-lg': size === 'lg',
        'modal-xl': size === 'xl',
      }"
    >
      <div class="modal-content shadow">
        <div class="modal-header bg-light">
          <h5 class="modal-title fw-bold">{{ title }}</h5>
          <button
            type="button"
            class="btn-close"
            aria-label="Zatvori"
            @click="emit('close')"
            :disabled="isSubmitting"
          ></button>
        </div>

        <div class="modal-body p-4">
          <slot></slot>
        </div>

        <div class="modal-footer bg-light" v-if="$slots.footer || submitLabel">
          <slot name="footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="emit('close')"
              :disabled="isSubmitting"
            >
              Odustani
            </button>
            <button
              type="button"
              class="btn"
              :class="submitVariant ? `btn-${submitVariant}` : 'btn-primary'"
              @click="emit('submit')"
              :disabled="isSubmitting"
            >
              <span
                v-if="isSubmitting"
                class="spinner-border spinner-border-sm me-1"
                role="status"
              ></span>
              {{ submitLabel || 'Sačuvaj' }}
            </button>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>
