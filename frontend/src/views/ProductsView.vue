<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../composables/useApi';
import { Product } from '../types';
import DataTable, { Column } from '../components/DataTable.vue';
import ModalDialog from '../components/ModalDialog.vue';
import StatusBadge from '../components/StatusBadge.vue';

const products = ref<Product[]>([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const alertMessage = ref<{ type: 'success' | 'danger'; text: string } | null>(null);

// Modal stanja
const showFormModal = ref(false);
const showDeleteModal = ref(false);
const showDetailsModal = ref(false);
const isEditMode = ref(false);
const selectedProduct = ref<Product | null>(null);
const productDetails = ref<any | null>(null);

// Form polja
const formSku = ref('');
const formName = ref('');
const formCategory = ref('');
const formUom = ref('kom');
const formPrice = ref<number>(0);
const formMinThreshold = ref<number>(10);

const columns: Column[] = [
  { key: 'sku', label: 'Šifra (SKU)', sortable: true },
  { key: 'name', label: 'Naziv artikla / materijala', sortable: true },
  { key: 'category', label: 'Kategorija', sortable: true },
  { key: 'unit_price', label: 'Cena po jed.', sortable: true },
  { key: 'current_stock', label: 'Stanje na lageru', sortable: true },
  { key: 'min_threshold', label: 'Min. prag', sortable: true },
  { key: 'total_value', label: 'Ukupna vrednost', sortable: true },
  { key: 'stock_status', label: 'Status zaliha' },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function showAlert(type: 'success' | 'danger', text: string) {
  alertMessage.value = { type, text };
  setTimeout(() => {
    alertMessage.value = null;
  }, 4000);
}

async function loadProducts() {
  isLoading.value = true;
  try {
    const res = await api.get('/products');
    if (res.data.success) {
      products.value = res.data.data;
    }
  } catch (error: any) {
    showAlert('danger', 'Greška pri učitavanju kataloga artikala.');
  } finally {
    isLoading.value = false;
  }
}

function openCreateModal() {
  isEditMode.value = false;
  selectedProduct.value = null;
  formSku.value = '';
  formName.value = '';
  formCategory.value = '';
  formUom.value = 'kom';
  formPrice.value = 0;
  formMinThreshold.value = 10;
  showFormModal.value = true;
}

function openEditModal(prod: Product) {
  isEditMode.value = true;
  selectedProduct.value = prod;
  formSku.value = prod.sku;
  formName.value = prod.name;
  formCategory.value = prod.category;
  formUom.value = prod.unit_of_measure;
  formPrice.value = prod.unit_price;
  formMinThreshold.value = prod.min_threshold;
  showFormModal.value = true;
}

async function openDetailsModal(prod: Product) {
  selectedProduct.value = prod;
  try {
    const res = await api.get(`/products/${prod.id}`);
    if (res.data.success) {
      productDetails.value = res.data.data;
      showDetailsModal.value = true;
    }
  } catch (error: any) {
    showAlert('danger', 'Greška pri dohvatanju detalja o stanju artikla.');
  }
}

function openDeleteModal(prod: Product) {
  selectedProduct.value = prod;
  showDeleteModal.value = true;
}

async function handleSaveProduct() {
  if (!formSku.value || !formName.value || !formCategory.value) {
    showAlert('danger', 'Molimo popunite obavezna polja (SKU, naziv, kategorija).');
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      sku: formSku.value.trim().toUpperCase(),
      name: formName.value.trim(),
      category: formCategory.value.trim(),
      unit_of_measure: formUom.value,
      unit_price: Number(formPrice.value) || 0,
      min_threshold: Number(formMinThreshold.value) || 10,
    };

    if (isEditMode.value && selectedProduct.value) {
      const res = await api.put(`/products/${selectedProduct.value.id}`, payload);
      if (res.data.success) {
        showAlert('success', 'Artikal je uspešno ažuriran.');
        showFormModal.value = false;
        loadProducts();
      }
    } else {
      const res = await api.post('/products', payload);
      if (res.data.success) {
        showAlert('success', 'Novi artikal je uspešno dodat u katalog.');
        showFormModal.value = false;
        loadProducts();
      }
    }
  } catch (error: any) {
    showAlert('danger', error.response?.data?.message || 'Greška pri čuvanju artikla.');
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDeleteProduct() {
  if (!selectedProduct.value) return;

  isSubmitting.value = true;
  try {
    const res = await api.delete(`/products/${selectedProduct.value.id}`);
    if (res.data.success) {
      showAlert('success', 'Artikal je uspešno obrisan.');
      showDeleteModal.value = false;
      loadProducts();
    }
  } catch (error: any) {
    showAlert('danger', error.response?.data?.message || 'Greška pri brisanju artikla.');
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  loadProducts();
});
</script>

<template>
  <div class="container-fluid px-4 py-4">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h3 class="fw-bold mb-1">
          <i class="bi bi-box-seam text-primary me-2"></i>Katalog artikala i materijala
        </h3>
        <p class="text-muted small mb-0">
          Katalog materijala sa pregledom jediničnih cena, minimalnih sigurnosnih pragova i stanja
        </p>
      </div>
      <button class="btn btn-primary btn-sm d-flex align-items-center" @click="openCreateModal">
        <i class="bi bi-plus-lg me-1"></i> Dodaj novi artikal
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
      :items="products"
      search-placeholder="Pretraži artikle po šifri, nazivu, kategoriji..."
    >
      <template #sku="{ value }">
        <span class="badge bg-secondary font-monospace">{{ value }}</span>
      </template>

      <template #name="{ item }">
        <div class="fw-semibold text-dark">{{ item.name }}</div>
      </template>

      <template #category="{ value }">
        <span class="badge bg-light text-dark border">{{ value }}</span>
      </template>

      <template #unit_price="{ item }">
        {{ formatCurrency(item.unit_price) }} / {{ item.unit_of_measure }}
      </template>

      <template #current_stock="{ item }">
        <span
          class="fw-bold fs-6"
          :class="{
            'text-success': item.current_stock > item.min_threshold,
            'text-warning': item.current_stock > 0 && item.current_stock <= item.min_threshold,
            'text-danger': item.current_stock <= 0,
          }"
        >
          {{ item.current_stock }} {{ item.unit_of_measure }}
        </span>
      </template>

      <template #min_threshold="{ item }">
        <span class="text-muted">{{ item.min_threshold }} {{ item.unit_of_measure }}</span>
      </template>

      <template #total_value="{ value }">
        <span class="fw-semibold">{{ formatCurrency(value || 0) }}</span>
      </template>

      <template #stock_status="{ value }">
        <StatusBadge type="stock" :value="value" />
      </template>

      <template #actions="{ item }">
        <button
          class="btn btn-outline-info btn-sm me-1"
          title="Raspodela po skladištima"
          @click="openDetailsModal(item)"
        >
          <i class="bi bi-geo-alt"></i>
        </button>
        <button
          class="btn btn-outline-secondary btn-sm me-1"
          title="Izmeni artikal"
          @click="openEditModal(item)"
        >
          <i class="bi bi-pencil"></i>
        </button>
        <button
          class="btn btn-outline-danger btn-sm"
          title="Obriši artikal"
          @click="openDeleteModal(item)"
        >
          <i class="bi bi-trash"></i>
        </button>
      </template>
    </DataTable>

    <!-- Modal za Dodavanje / Izmenu artikla -->
    <ModalDialog
      :show="showFormModal"
      :title="isEditMode ? 'Izmena podataka o artiklu' : 'Novi artikal u katalogu'"
      :submit-label="isEditMode ? 'Sačuvaj izmene' : 'Dodaj artikal'"
      :is-submitting="isSubmitting"
      size="lg"
      @close="showFormModal = false"
      @submit="handleSaveProduct"
    >
      <form @submit.prevent="handleSaveProduct">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label small fw-semibold">Šifra materijala (SKU) *</label>
            <input
              type="text"
              v-model="formSku"
              class="form-control text-uppercase"
              placeholder="MAT-2040"
              required
            />
          </div>
          <div class="col-md-8">
            <label class="form-label small fw-semibold">Naziv artikla / materijala *</label>
            <input
              type="text"
              v-model="formName"
              class="form-control"
              required
            />
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Kategorija *</label>
            <input
              type="text"
              v-model="formCategory"
              class="form-control"
              required
            />
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Jedinica mere (UOM)</label>
            <select v-model="formUom" class="form-select">
              <option value="kom">kom (komad)</option>
              <option value="kg">kg (kilogram)</option>
              <option value="m">m (metar)</option>
              <option value="l">l (litar)</option>
              <option value="pak">pak (pakovanje)</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Jedinična cena (RSD)</label>
            <div class="input-group">
              <input
                type="number"
                v-model="formPrice"
                class="form-control"
                min="0"
                step="0.01"
              />
              <span class="input-group-text">RSD</span>
            </div>
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Minimalni sigurnosni prag zaliha</label>
            <input
              type="number"
              v-model="formMinThreshold"
              class="form-control"
              min="0"
            />
            <div class="form-text small">Kada zaliha padne ispod ove vrednosti, sistem pali alarm.</div>
          </div>
        </div>
      </form>
    </ModalDialog>

    <!-- Modal za Pregled stanja artikla po pojedinačnim skladištima -->
    <ModalDialog
      :show="showDetailsModal"
      title="Raspodela zaliha po lokacijama"
      size="md"
      @close="showDetailsModal = false"
    >
      <div v-if="productDetails">
        <div class="mb-3 p-3 bg-light rounded">
          <div class="text-muted small">Artikal:</div>
          <div class="fw-bold fs-5 text-primary">{{ productDetails.name }}</div>
          <div class="small font-monospace text-secondary">SKU: {{ productDetails.sku }} | Kategorija: {{ productDetails.category }}</div>
        </div>

        <h6 class="fw-bold mb-2">Stanje po skladištima:</h6>
        <ul class="list-group mb-3">
          <li
            v-for="wh in productDetails.warehouse_breakdown"
            :key="wh.warehouse_id"
            class="list-group-item d-flex justify-content-between align-items-center"
          >
            <div>
              <i class="bi bi-geo-alt text-primary me-1"></i>
              <span class="fw-semibold">{{ wh.warehouse_name }}</span>
              <span class="text-muted small ms-1">({{ wh.warehouse_city }})</span>
            </div>
            <span
              class="badge rounded-pill fs-6"
              :class="wh.stock_in_warehouse > 0 ? 'bg-success' : 'bg-secondary'"
            >
              {{ wh.stock_in_warehouse }} {{ productDetails.unit_of_measure }}
            </span>
          </li>
        </ul>
      </div>

      <template #footer>
        <button type="button" class="btn btn-secondary ms-auto" @click="showDetailsModal = false">
          Zatvori
        </button>
      </template>
    </ModalDialog>

    <!-- Modal za Potvrdu brisanja artikla -->
    <ModalDialog
      :show="showDeleteModal"
      title="Potvrda brisanja artikla"
      submit-label="Obriši artikal"
      submit-variant="danger"
      :is-submitting="isSubmitting"
      size="sm"
      @close="showDeleteModal = false"
      @submit="handleDeleteProduct"
    >
      <div class="text-center py-2" v-if="selectedProduct">
        <i class="bi bi-exclamation-triangle text-danger fs-1 d-block mb-2"></i>
        <p class="mb-1">Da li ste sigurni da želite da obrišete artikal iz kataloga?</p>
        <p class="fw-bold text-dark">{{ selectedProduct.name }} ({{ selectedProduct.sku }})</p>
        <p class="text-muted small mb-0">
          Upozorenje: Brisanje artikla uklanja i sva povezana stanja na zalihama.
        </p>
      </div>
    </ModalDialog>
  </div>
</template>
