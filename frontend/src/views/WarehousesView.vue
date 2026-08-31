<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../composables/useApi';
import { Warehouse } from '../types';
import DataTable, { Column } from '../components/DataTable.vue';
import ModalDialog from '../components/ModalDialog.vue';
import StatusBadge from '../components/StatusBadge.vue';

const warehouses = ref<Warehouse[]>([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const alertMessage = ref<{ type: 'success' | 'danger'; text: string } | null>(null);

// Modal stanja
const showFormModal = ref(false);
const showDeleteModal = ref(false);
const isEditMode = ref(false);
const selectedWarehouse = ref<Warehouse | null>(null);

// Form polja
const formCode = ref('');
const formName = ref('');
const formCity = ref('');
const formAddress = ref('');
const formCapacity = ref(1000);
const formIsActive = ref(true);

const columns: Column[] = [
  { key: 'code', label: 'Šifra', sortable: true },
  { key: 'name', label: 'Naziv skladišta', sortable: true },
  { key: 'city', label: 'Grad / Lokacija', sortable: true },
  { key: 'address', label: 'Adresa' },
  { key: 'capacity_sqm', label: 'Kapacitet (m²)', sortable: true },
  { key: 'is_active', label: 'Status' },
];

async function loadWarehouses() {
  isLoading.value = true;
  try {
    const res = await api.get('/warehouses');
    if (res.data.success) {
      warehouses.value = res.data.data;
    }
  } catch (error: any) {
    showAlert('danger', 'Greška pri učitavanju skladišta.');
  } finally {
    isLoading.value = false;
  }
}

function showAlert(type: 'success' | 'danger', text: string) {
  alertMessage.value = { type, text };
  setTimeout(() => {
    alertMessage.value = null;
  }, 4000);
}

function openCreateModal() {
  isEditMode.value = false;
  selectedWarehouse.value = null;
  formCode.value = '';
  formName.value = '';
  formCity.value = '';
  formAddress.value = '';
  formCapacity.value = 1000;
  formIsActive.value = true;
  showFormModal.value = true;
}

function openEditModal(wh: Warehouse) {
  isEditMode.value = true;
  selectedWarehouse.value = wh;
  formCode.value = wh.code;
  formName.value = wh.name;
  formCity.value = wh.city;
  formAddress.value = wh.address;
  formCapacity.value = wh.capacity_sqm;
  formIsActive.value = Boolean(wh.is_active);
  showFormModal.value = true;
}

function openDeleteModal(wh: Warehouse) {
  selectedWarehouse.value = wh;
  showDeleteModal.value = true;
}

async function handleSaveWarehouse() {
  if (!formCode.value || !formName.value || !formCity.value || !formAddress.value) {
    showAlert('danger', 'Molimo popunite sva obavezna polja.');
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      code: formCode.value.trim().toUpperCase(),
      name: formName.value.trim(),
      city: formCity.value.trim(),
      address: formAddress.value.trim(),
      capacity_sqm: Number(formCapacity.value),
      is_active: formIsActive.value,
    };

    if (isEditMode.value && selectedWarehouse.value) {
      const res = await api.put(`/warehouses/${selectedWarehouse.value.id}`, payload);
      if (res.data.success) {
        showAlert('success', 'Podaci o skladištu su uspešno ažurirani.');
        showFormModal.value = false;
        loadWarehouses();
      }
    } else {
      const res = await api.post('/warehouses', payload);
      if (res.data.success) {
        showAlert('success', 'Novo skladište je uspešno kreirano.');
        showFormModal.value = false;
        loadWarehouses();
      }
    }
  } catch (error: any) {
    showAlert('danger', error.response?.data?.message || 'Greška pri čuvanju skladišta.');
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDeleteWarehouse() {
  if (!selectedWarehouse.value) return;

  isSubmitting.value = true;
  try {
    const res = await api.delete(`/warehouses/${selectedWarehouse.value.id}`);
    if (res.data.success) {
      showAlert('success', 'Skladište je uspešno obrisano.');
      showDeleteModal.value = false;
      loadWarehouses();
    }
  } catch (error: any) {
    showAlert('danger', error.response?.data?.message || 'Nije moguće obrisati skladište.');
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  loadWarehouses();
});
</script>

<template>
  <div class="container-fluid px-4 py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h3 class="fw-bold mb-1">
          <i class="bi bi-buildings text-primary me-2"></i>Upravljanje skladištima
        </h3>
        <p class="text-muted small mb-0">
          Pregled i administracija distributivnih i pogonskih lokacija (Beograd, Niš, Vršac...)
        </p>
      </div>
      <button class="btn btn-primary btn-sm d-flex align-items-center" @click="openCreateModal">
        <i class="bi bi-plus-lg me-1"></i> Dodaj novo skladište
      </button>
    </div>

    <!-- Alert -->
    <div
      v-if="alertMessage"
      class="alert alert-dismissible fade show"
      :class="`alert-${alertMessage.type}`"
      role="alert"
    >
      <i class="bi bi-info-circle-fill me-2"></i>
      {{ alertMessage.text }}
      <button type="button" class="btn-close" @click="alertMessage = null"></button>
    </div>

    <!-- Reusable DataTable -->
    <DataTable
      :columns="columns"
      :items="warehouses"
      search-placeholder="Pretraži skladišta po šifri, gradu, nazivu..."
    >
      <template #code="{ value }">
        <span class="badge bg-primary-subtle text-primary border border-primary-subtle font-monospace">
          {{ value }}
        </span>
      </template>

      <template #name="{ item }">
        <div class="fw-semibold">{{ item.name }}</div>
      </template>

      <template #city="{ value }">
        <i class="bi bi-geo-alt text-danger me-1"></i>{{ value }}
      </template>

      <template #capacity_sqm="{ value }">
        {{ value }} m²
      </template>

      <template #is_active="{ value }">
        <StatusBadge type="active" :value="value" />
      </template>

      <template #actions="{ item }">
        <button
          class="btn btn-outline-secondary btn-sm me-1"
          title="Izmeni skladište"
          @click="openEditModal(item)"
        >
          <i class="bi bi-pencil"></i>
        </button>
        <button
          class="btn btn-outline-danger btn-sm"
          title="Obriši skladište"
          @click="openDeleteModal(item)"
        >
          <i class="bi bi-trash"></i>
        </button>
      </template>
    </DataTable>

    <!-- Modal za Dodavanje / Izmenu skladišta -->
    <ModalDialog
      :show="showFormModal"
      :title="isEditMode ? 'Izmena podataka o skladištu' : 'Kreiranje novog skladišta'"
      :submit-label="isEditMode ? 'Sačuvaj izmene' : 'Kreiraj skladište'"
      :is-submitting="isSubmitting"
      @close="showFormModal = false"
      @submit="handleSaveWarehouse"
    >
      <form @submit.prevent="handleSaveWarehouse">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label small fw-semibold">Šifra skladišta *</label>
            <input
              type="text"
              v-model="formCode"
              class="form-control text-uppercase"
              placeholder="WH-KG-01"
              required
            />
          </div>
          <div class="col-md-8">
            <label class="form-label small fw-semibold">Naziv skladišta *</label>
            <input
              type="text"
              v-model="formName"
              class="form-control"
              required
            />
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Grad / Lokacija *</label>
            <input
              type="text"
              v-model="formCity"
              class="form-control"
              required
            />
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Kapacitet (m²)</label>
            <input
              type="number"
              v-model="formCapacity"
              class="form-control"
              min="10"
            />
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Puna adresa *</label>
            <input
              type="text"
              v-model="formAddress"
              class="form-control"
              required
            />
          </div>
          <div class="col-12">
            <div class="form-check form-switch mt-2">
              <input
                class="form-check-input"
                type="checkbox"
                id="activeSwitch"
                v-model="formIsActive"
              />
              <label class="form-check-label small fw-semibold" for="activeSwitch">
                Skladište je aktivno za promet i knjiženje
              </label>
            </div>
          </div>
        </div>
      </form>
    </ModalDialog>

    <!-- Modal za Potvrdu brisanja skladišta -->
    <ModalDialog
      :show="showDeleteModal"
      title="Potvrda brisanja skladišta"
      submit-label="Obriši skladište"
      submit-variant="danger"
      :is-submitting="isSubmitting"
      size="sm"
      @close="showDeleteModal = false"
      @submit="handleDeleteWarehouse"
    >
      <div class="text-center py-2" v-if="selectedWarehouse">
        <i class="bi bi-exclamation-triangle text-danger fs-1 d-block mb-2"></i>
        <p class="mb-1">Da li ste sigurni da želite da obrišete skladište?</p>
        <p class="fw-bold text-dark">{{ selectedWarehouse.name }} ({{ selectedWarehouse.code }})</p>
        <p class="text-muted small mb-0">
          Napomena: Brisanje neće biti dozvoljeno ukoliko na ovom skladištu postoje evidentirana knjiženja zaliha.
        </p>
      </div>
    </ModalDialog>
  </div>
</template>
