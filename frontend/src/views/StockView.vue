<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../composables/useApi';
import { StockMovement, Warehouse, Product, ReconciliationReport } from '../types';
import DataTable, { Column } from '../components/DataTable.vue';
import ModalDialog from '../components/ModalDialog.vue';
import StatusBadge from '../components/StatusBadge.vue';

const movements = ref<StockMovement[]>([]);
const warehouses = ref<Warehouse[]>([]);
const products = ref<Product[]>([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const alertMessage = ref<{ type: 'success' | 'danger'; text: string } | null>(null);

// Filteri
const filterWarehouseId = ref('');
const filterMovementType = ref('');

// Modal za novo knjiženje
const showCreateModal = ref(false);
const modalError = ref('');
const formProductId = ref<number | ''>('');
const formWarehouseId = ref<number | ''>('');
const formTargetWarehouseId = ref<number | ''>('');
const formMovementType = ref<'101_INBOUND' | '201_OUTBOUND' | '551_SCRAP' | '301_TRANSFER'>('101_INBOUND');
const formQuantity = ref<number>(1);
const formReferenceDoc = ref('');
const formNotes = ref('');

// Modal za Detalje knjiženja (uključujući kompletnu Napomenu)
const showDetailsModal = ref(false);
const selectedMovement = ref<StockMovement | null>(null);

// Modal za Rekoncilijaciju (Usaglašavanje stanja)
const showReconcileModal = ref(false);
const reconcileReport = ref<ReconciliationReport | null>(null);
const isReconciling = ref(false);

// Definicija kolona bez duplirane Akcije kolone
const columns: Column[] = [
  { key: 'movement_type', label: 'Vrsta knjiženja', sortable: true },
  { key: 'product_name', label: 'Artikal / Materijal', sortable: true },
  { key: 'warehouse_name', label: 'Skladište (Grad)', sortable: true },
  { key: 'quantity', label: 'Količina', sortable: true },
  { key: 'reference_doc', label: 'Dokument & Napomena', sortable: true },
  { key: 'user_name', label: 'Knjižio korisnik', sortable: true },
  { key: 'movement_date', label: 'Datum i vreme', sortable: true },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function showAlert(type: 'success' | 'danger', text: string) {
  alertMessage.value = { type, text };
  setTimeout(() => {
    alertMessage.value = null;
  }, 4000);
}

async function loadData() {
  isLoading.value = true;
  try {
    const [movRes, whRes, prodRes] = await Promise.all([
      api.get('/stock-movements', {
        params: {
          warehouse_id: filterWarehouseId.value || undefined,
          type: filterMovementType.value || undefined,
        },
      }),
      api.get('/warehouses'),
      api.get('/products'),
    ]);

    if (movRes.data.success) movements.value = movRes.data.data;
    if (whRes.data.success) warehouses.value = whRes.data.data;
    if (prodRes.data.success) products.value = prodRes.data.data;
  } catch (error: any) {
    showAlert('danger', 'Greška pri učitavanju dnevnika zaliha.');
  } finally {
    isLoading.value = false;
  }
}

function openCreateModal() {
  modalError.value = '';
  formProductId.value = products.value.length > 0 ? products.value[0].id : '';
  formWarehouseId.value = warehouses.value.length > 0 ? warehouses.value[0].id : '';
  formTargetWarehouseId.value = warehouses.value.length > 1 ? warehouses.value[1].id : '';
  formMovementType.value = '101_INBOUND';
  formQuantity.value = 1;
  formReferenceDoc.value = `DOK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  formNotes.value = '';
  showCreateModal.value = true;
}

function openDetails(item: StockMovement) {
  selectedMovement.value = item;
  showDetailsModal.value = true;
}

const selectedProductInfo = computed(() => {
  return products.value.find((p) => p.id === formProductId.value);
});

// Lista dostupnih odredišnih skladišta za transfer (isključuje polazno)
const availableTargetWarehouses = computed(() => {
  return warehouses.value.filter((w) => w.id !== formWarehouseId.value);
});

async function handleCreateMovement() {
  modalError.value = '';

  if (!formProductId.value || !formWarehouseId.value || !formQuantity.value) {
    modalError.value = 'Molimo popunite sva obavezna polja.';
    return;
  }

  if (formQuantity.value <= 0) {
    modalError.value = 'Količina mora biti veća od 0.';
    return;
  }

  if (formMovementType.value === '301_TRANSFER') {
    if (!formTargetWarehouseId.value) {
      modalError.value = 'Molimo izaberite odredišno skladište za transfer.';
      return;
    }
    if (formWarehouseId.value === formTargetWarehouseId.value) {
      modalError.value = 'Polazno i odredišno skladište ne mogu biti ista lokacija.';
      return;
    }
  }

  isSubmitting.value = true;
  try {
    const payload: any = {
      product_id: Number(formProductId.value),
      warehouse_id: Number(formWarehouseId.value),
      movement_type: formMovementType.value,
      quantity: Number(formQuantity.value),
      reference_doc: formReferenceDoc.value.trim() || null,
      notes: formNotes.value.trim() || null,
    };

    if (formMovementType.value === '301_TRANSFER') {
      payload.target_warehouse_id = Number(formTargetWarehouseId.value);
    }

    const res = await api.post('/stock-movements', payload);
    if (res.data.success) {
      showAlert('success', res.data.message || 'Promena je uspešno proknjižena.');
      showCreateModal.value = false;
      // Automatski reset filtera kako bi novo knjiženje odmah bilo vidljivo na vrhu tabele
      filterWarehouseId.value = '';
      filterMovementType.value = '';
      loadData();
    }
  } catch (error: any) {
    // Greška se prikazuje istaknuto unutar samog modala
    modalError.value = error.response?.data?.message || 'Greška pri knjiženju promene.';
  } finally {
    isSubmitting.value = false;
  }
}

async function openReconciliationModal() {
  isReconciling.value = true;
  showReconcileModal.value = true;
  try {
    const res = await api.get('/stock-movements/reconcile');
    if (res.data.success) {
      reconcileReport.value = res.data.data;
    }
  } catch (error) {
    showAlert('danger', 'Greška pri pokretanju reconciliation provere.');
  } finally {
    isReconciling.value = false;
  }
}

async function handleFixReconciliation() {
  isReconciling.value = true;
  try {
    const res = await api.post('/stock-movements/reconcile/fix');
    if (res.data.success) {
      showAlert('success', res.data.message);
      openReconciliationModal();
      loadData();
    }
  } catch (error) {
    showAlert('danger', 'Greška pri automatskoj popravci usaglašenosti.');
  } finally {
    isReconciling.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="container-fluid px-4 py-4">
    <!-- Header -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
      <div>
        <h3 class="fw-bold mb-0">
          <i class="bi bi-journal-text text-primary me-2"></i>Dnevnik zaliha i prometa
        </h3>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-dark btn-sm d-flex align-items-center" @click="openReconciliationModal">
          <i class="bi bi-shield-check text-success me-1"></i> Usaglašavanje stanja
        </button>
        <button class="btn btn-success btn-sm d-flex align-items-center" @click="openCreateModal">
          <i class="bi bi-plus-circle me-1"></i> Novo knjiženje
        </button>
      </div>
    </div>

    <!-- Alert na osnovnoj stranici -->
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

    <!-- Filter Bar -->
    <div class="card border-0 shadow-sm rounded-3 mb-4">
      <div class="card-body p-3">
        <div class="row g-3 align-items-center">
          <div class="col-md-4">
            <label class="form-label small fw-semibold mb-1">Filtriraj po skladištu:</label>
            <select v-model="filterWarehouseId" @change="loadData" class="form-select form-select-sm">
              <option value="">Sva skladišta (Beograd, Niš, Vršac...)</option>
              <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">
                {{ wh.name }} ({{ wh.city }})
              </option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-semibold mb-1">Filtriraj po vrsti kretanja:</label>
            <select v-model="filterMovementType" @change="loadData" class="form-select form-select-sm">
              <option value="">Sve vrste kretanja</option>
              <option value="101_INBOUND">101 | Prijem robe od dobavljača (Ulaz)</option>
              <option value="201_OUTBOUND">201 | Izdavanje robe za nalog (Izlaz)</option>
              <option value="551_SCRAP">551 | Rashodovanje / Otpis (Izlaz)</option>
              <option value="301_TRANSFER_OUT">301 | Međuskladišni prenos (Izlaz)</option>
              <option value="301_TRANSFER_IN">301 | Međuskladišni prenos (Ulaz)</option>
            </select>
          </div>
          <div class="col-md-4 text-md-end pt-md-3">
            <button class="btn btn-outline-secondary btn-sm" @click="filterWarehouseId = ''; filterMovementType = ''; loadData()">
              <i class="bi bi-x-circle me-1"></i> Poništi filtere
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reusable DataTable -->
    <DataTable
      :columns="columns"
      :items="movements"
      search-placeholder="Pretraži po artiklu, skladištu, dokumentu, korisniku, napomeni..."
    >
      <template #movement_type="{ value }">
        <StatusBadge type="movement" :value="value" />
      </template>

      <template #product_name="{ item }">
        <div class="fw-semibold">{{ item.product_name }}</div>
        <span class="badge bg-secondary font-monospace" style="font-size: 0.7rem;">{{ item.product_sku }}</span>
      </template>

      <template #warehouse_name="{ item }">
        <div>{{ item.warehouse_name }}</div>
        <span class="small text-muted"><i class="bi bi-geo-alt me-1"></i>{{ item.warehouse_city }}</span>
      </template>

      <template #quantity="{ item }">
        <span
          class="fw-bold fs-6"
          :class="item.movement_type === '101_INBOUND' || item.movement_type === 'INBOUND' || item.movement_type === '301_TRANSFER_IN' ? 'text-success' : 'text-danger'"
        >
          {{ item.movement_type === '101_INBOUND' || item.movement_type === 'INBOUND' || item.movement_type === '301_TRANSFER_IN' ? '+' : '-' }}{{ item.quantity }} {{ item.unit_of_measure }}
        </span>
      </template>

      <template #reference_doc="{ item }">
        <div>
          <span v-if="item.reference_doc" class="badge bg-light text-dark border font-monospace">{{ item.reference_doc }}</span>
          <span v-else class="text-muted small">-</span>
        </div>
        <!-- Prikaz napomene direktno u tabeli -->
        <div v-if="item.notes" class="small text-muted text-truncate mt-1" style="max-width: 220px;" :title="item.notes">
          <i class="bi bi-chat-left-text text-primary me-1"></i>{{ item.notes }}
        </div>
      </template>

      <template #user_name="{ value }">
        <span class="small text-muted"><i class="bi bi-person me-1"></i>{{ value || 'Sistem' }}</span>
      </template>

      <template #movement_date="{ value }">
        <span class="small text-muted">{{ formatDate(value) }}</span>
      </template>

      <template #actions="{ item }">
        <button
          class="btn btn-sm btn-outline-info d-flex align-items-center"
          title="Pogledaj kompletne detalje i napomenu"
          @click="openDetails(item)"
        >
          <i class="bi bi-eye me-1"></i> Detalji
        </button>
      </template>
    </DataTable>

    <!-- Modal za Novo Knjiženje -->
    <!-- Onemogućeno zatvaranje klikom van modala - zatvara se isključivo na 'Odustani' ili 'X' -->
    <ModalDialog
      :show="showCreateModal"
      title="Novo skladišno knjiženje"
      submit-label="Izvrši knjiženje"
      :submit-variant="formMovementType === '101_INBOUND' ? 'success' : formMovementType === '201_OUTBOUND' ? 'primary' : formMovementType === '301_TRANSFER' ? 'info' : 'danger'"
      :is-submitting="isSubmitting"
      :close-on-click-outside="false"
      size="lg"
      @close="showCreateModal = false"
      @submit="handleCreateMovement"
    >
      <!-- Istaknuta poruka o grešci unutar samog modala -->
      <div v-if="modalError" class="alert alert-danger py-2 px-3 small d-flex align-items-center mb-3">
        <i class="bi bi-exclamation-triangle-fill fs-5 me-2 flex-shrink-0"></i>
        <div class="fw-semibold">{{ modalError }}</div>
      </div>

      <form @submit.prevent="handleCreateMovement">
        <div class="row g-3">
          <!-- Tip knjiženja -->
          <div class="col-12">
            <label class="form-label small fw-semibold">Vrsta kretanja materijala *</label>
            <div class="row g-2">
              <div class="col-md-3 col-sm-6">
                <div class="form-check p-3 border rounded h-100" :class="{ 'bg-success-subtle border-success': formMovementType === '101_INBOUND' }">
                  <input
                    class="form-check-input"
                    type="radio"
                    id="type101"
                    value="101_INBOUND"
                    v-model="formMovementType"
                    @change="modalError = ''"
                  />
                  <label class="form-check-label fw-bold text-success small" for="type101">
                    101 | PRIJEM ROBE<br>
                    <span class="text-muted fw-normal" style="font-size: 0.75rem;">Ulaz od dobavljača (+Qty)</span>
                  </label>
                </div>
              </div>

              <div class="col-md-3 col-sm-6">
                <div class="form-check p-3 border rounded h-100" :class="{ 'bg-primary-subtle border-primary': formMovementType === '201_OUTBOUND' }">
                  <input
                    class="form-check-input"
                    type="radio"
                    id="type201"
                    value="201_OUTBOUND"
                    v-model="formMovementType"
                    @change="modalError = ''"
                  />
                  <label class="form-check-label fw-bold text-primary small" for="type201">
                    201 | IZDAVANJE ROBE<br>
                    <span class="text-muted fw-normal" style="font-size: 0.75rem;">Izlaz za kupca (-Qty)</span>
                  </label>
                </div>
              </div>

              <div class="col-md-3 col-sm-6">
                <div class="form-check p-3 border rounded h-100" :class="{ 'bg-info-subtle border-info': formMovementType === '301_TRANSFER' }">
                  <input
                    class="form-check-input"
                    type="radio"
                    id="type301"
                    value="301_TRANSFER"
                    v-model="formMovementType"
                    @change="modalError = ''"
                  />
                  <label class="form-check-label fw-bold text-info-emphasis small" for="type301">
                    301 | PRENOS (TRANSFER)<br>
                    <span class="text-muted fw-normal" style="font-size: 0.75rem;">Sa skladišta na skladište</span>
                  </label>
                </div>
              </div>

              <div class="col-md-3 col-sm-6">
                <div class="form-check p-3 border rounded h-100" :class="{ 'bg-danger-subtle border-danger': formMovementType === '551_SCRAP' }">
                  <input
                    class="form-check-input"
                    type="radio"
                    id="type551"
                    value="551_SCRAP"
                    v-model="formMovementType"
                    @change="modalError = ''"
                  />
                  <label class="form-check-label fw-bold text-danger small" for="type551">
                    551 | RASHOD / OTPIS<br>
                    <span class="text-muted fw-normal" style="font-size: 0.75rem;">Otpis oštećene robe (-Qty)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Artikal -->
          <div class="col-md-12">
            <label class="form-label small fw-semibold">Izaberite artikal / materijal *</label>
            <select v-model="formProductId" class="form-select" @change="modalError = ''" required>
              <option v-for="p in products" :key="p.id" :value="p.id">
                [{{ p.sku }}] {{ p.name }}
              </option>
            </select>
          </div>

          <!-- Skladišta -->
          <!-- Standardno knjiženje (1 skladište) -->
          <div class="col-md-6" v-if="formMovementType !== '301_TRANSFER'">
            <label class="form-label small fw-semibold">Skladišna lokacija *</label>
            <select v-model="formWarehouseId" class="form-select" @change="modalError = ''" required>
              <option v-for="w in warehouses" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.city }})
              </option>
            </select>
          </div>

          <!-- Transfer knjiženje (Polazno i Odredišno skladište) -->
          <div class="col-md-6" v-if="formMovementType === '301_TRANSFER'">
            <label class="form-label small fw-semibold text-danger">Polazno skladište (Mesto slanja - Izlaz) *</label>
            <select v-model="formWarehouseId" class="form-select border-danger" @change="modalError = ''" required>
              <option v-for="w in warehouses" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.city }})
              </option>
            </select>
          </div>

          <div class="col-md-6" v-if="formMovementType === '301_TRANSFER'">
            <label class="form-label small fw-semibold text-success">Odredišno skladište (Mesto prijema - Ulaz) *</label>
            <select v-model="formTargetWarehouseId" class="form-select border-success" @change="modalError = ''" required>
              <option v-for="w in availableTargetWarehouses" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.city }})
              </option>
            </select>
          </div>

          <!-- Količina -->
          <div class="col-md-6">
            <label class="form-label small fw-semibold">
              Količina ({{ selectedProductInfo?.unit_of_measure || 'kom' }}) *
            </label>
            <input
              type="number"
              v-model="formQuantity"
              class="form-control"
              min="1"
              @input="modalError = ''"
              required
            />
          </div>

          <!-- Broj dokumenta -->
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Broj pratećeg dokumenta (Prijemnica / Nalog / Faktura)</label>
            <input
              type="text"
              v-model="formReferenceDoc"
              class="form-control font-monospace"
              placeholder="npr. PR-2026/044, OTP-2026/112 ili TR-2026/001"
            />
          </div>

          <!-- Napomena -->
          <div class="col-12">
            <label class="form-label small fw-semibold">Napomena / Razlog knjiženja (Vidljiva u detaljima i dnevniku)</label>
            <textarea
              v-model="formNotes"
              class="form-control"
              rows="2"
              placeholder="npr. Isporuka dobavljača po ugovoru #104 ili prenos sirovina u pogonsko skladište Vršac"
            ></textarea>
          </div>
        </div>
      </form>
    </ModalDialog>

    <!-- Modal za Pregled Detalja Knjiženja (i čitanje kompletne Napomene) -->
    <ModalDialog
      :show="showDetailsModal"
      title="Detalji knjiženja zaliha"
      size="md"
      @close="showDetailsModal = false"
    >
      <div v-if="selectedMovement">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <StatusBadge type="movement" :value="selectedMovement.movement_type" />
          <span class="badge bg-light text-dark border font-monospace fs-6">
            {{ selectedMovement.reference_doc || 'BEZ DOKUMENTA' }}
          </span>
        </div>

        <ul class="list-group list-group-flush mb-3">
          <li class="list-group-item d-flex justify-content-between px-0">
            <span class="text-muted">Artikal / Materijal:</span>
            <span class="fw-bold">{{ selectedMovement.product_name }}</span>
          </li>
          <li class="list-group-item d-flex justify-content-between px-0">
            <span class="text-muted">Šifra artikla (SKU):</span>
            <span class="badge bg-secondary font-monospace">{{ selectedMovement.product_sku }}</span>
          </li>
          <li class="list-group-item d-flex justify-content-between px-0">
            <span class="text-muted">Skladišna lokacija:</span>
            <span>{{ selectedMovement.warehouse_name }} (<strong>{{ selectedMovement.warehouse_city }}</strong>)</span>
          </li>
          <li class="list-group-item d-flex justify-content-between px-0">
            <span class="text-muted">Knjižena količina:</span>
            <span
              class="fw-bold"
              :class="selectedMovement.movement_type === '101_INBOUND' || selectedMovement.movement_type === 'INBOUND' || selectedMovement.movement_type === '301_TRANSFER_IN' ? 'text-success' : 'text-danger'"
            >
              {{ selectedMovement.movement_type === '101_INBOUND' || selectedMovement.movement_type === 'INBOUND' || selectedMovement.movement_type === '301_TRANSFER_IN' ? '+' : '-' }}{{ selectedMovement.quantity }} {{ selectedMovement.unit_of_measure }}
            </span>
          </li>
          <li class="list-group-item d-flex justify-content-between px-0">
            <span class="text-muted">Knjižio korisnik:</span>
            <span><i class="bi bi-person me-1"></i>{{ selectedMovement.user_name || 'Sistem' }}</span>
          </li>
          <li class="list-group-item d-flex justify-content-between px-0">
            <span class="text-muted">Datum i vreme knjiženja:</span>
            <span>{{ formatDate(selectedMovement.movement_date) }}</span>
          </li>
        </ul>

        <!-- Polje za čitanje Napomene -->
        <div class="card border bg-light">
          <div class="card-body p-3">
            <div class="small fw-bold text-dark mb-1">
              <i class="bi bi-chat-left-text-fill text-primary me-1"></i> Napomena / Razlog knjiženja:
            </div>
            <div class="text-secondary small fst-italic">
              {{ selectedMovement.notes || 'Nema unete napomene za ovo knjiženje.' }}
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <button type="button" class="btn btn-secondary ms-auto" @click="showDetailsModal = false">
          Zatvori
        </button>
      </template>
    </ModalDialog>

    <!-- Modal za Rekoncilijaciju -->
    <ModalDialog
      :show="showReconcileModal"
      title="Provera usaglašenosti stanja zaliha"
      size="xl"
      @close="showReconcileModal = false"
    >
      <div v-if="isReconciling" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <div class="mt-2 text-muted small">Izračunavanje SUM(Dnevnik) i poređenje sa tabelom stanja...</div>
      </div>

      <div v-else-if="reconcileReport">
        <!-- Status Banner -->
        <div
          class="alert d-flex align-items-center mb-3"
          :class="reconcileReport.is_healthy ? 'alert-success' : 'alert-danger'"
        >
          <i
            class="bi fs-4 me-3"
            :class="reconcileReport.is_healthy ? 'bi-shield-fill-check text-success' : 'bi-exclamation-triangle-fill text-danger'"
          ></i>
          <div>
            <div class="fw-bold">
              {{ reconcileReport.is_healthy ? 'Integritet zaliha je 100% potvrđen (Potpuno usaglašeno)' : 'Detektovano neslaganje zaliha!' }}
            </div>
            <div class="small">
              Ukupno proverenih lokacija artikala: <strong>{{ reconcileReport.total_records_checked }}</strong> | 
              Broj odstupanja: <strong>{{ reconcileReport.total_discrepancies }}</strong>
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-0">
            <thead class="table-light small">
              <tr>
                <th>Artikal</th>
                <th>Skladište</th>
                <th class="text-center">Zbir iz dnevnika</th>
                <th class="text-center">Trenutno stanje</th>
                <th class="text-center">Razlika (Δ)</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in reconcileReport.details" :key="`${row.product_id}-${row.warehouse_id}`">
                <td>
                  <div class="fw-semibold small">{{ row.product_name }}</div>
                  <span class="badge bg-secondary font-monospace" style="font-size: 0.65rem;">{{ row.product_sku }}</span>
                </td>
                <td class="small">{{ row.warehouse_name }} ({{ row.warehouse_city }})</td>
                <td class="text-center fw-bold">{{ row.ledger_sum }}</td>
                <td class="text-center fw-bold">{{ row.snapshot_quantity }}</td>
                <td class="text-center font-monospace" :class="row.delta === 0 ? 'text-success' : 'text-danger fw-bold'">
                  {{ row.delta === 0 ? '0' : row.delta }}
                </td>
                <td class="text-center">
                  <span v-if="row.is_match" class="badge bg-success-subtle text-success border border-success-subtle">
                    <i class="bi bi-check me-1"></i>Usaglašeno
                  </span>
                  <span v-else class="badge bg-danger">
                    <i class="bi bi-x me-1"></i>Odstupanje
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template #footer>
        <button
          v-if="reconcileReport && !reconcileReport.is_healthy"
          type="button"
          class="btn btn-warning me-auto"
          @click="handleFixReconciliation"
          :disabled="isReconciling"
        >
          <i class="bi bi-wrench me-1"></i> Automatski usaglasi stanje
        </button>
        <button type="button" class="btn btn-secondary" @click="showReconcileModal = false">Zatvori</button>
      </template>
    </ModalDialog>
  </div>
</template>
