<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../composables/useApi';
import { DashboardStats } from '../types';
import StatusBadge from '../components/StatusBadge.vue';

const stats = ref<DashboardStats | null>(null);
const isLoading = ref(true);
const errorMessage = ref('');

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'currency',
    currency: 'RSD',
    maximumFractionDigits: 0,
  }).format(amount);
}

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

async function loadDashboardData() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const res = await api.get('/dashboard/stats');
    if (res.data.success) {
      stats.value = res.data.data;
    }
  } catch (error: any) {
    errorMessage.value = 'Neuspešno učitavanje podataka sa servera. Proverite da li je backend pokrenut.';
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadDashboardData();
});
</script>

<template>
  <div class="container-fluid px-4 py-4">
    <!-- Header -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
      <div>
        <h3 class="fw-bold mb-1">
          <i class="bi bi-speedometer2 text-primary me-2"></i>Kontrolna tabla
        </h3>
        <p class="text-muted small mb-0">
          Pregled stanja zaliha i prometa u realnom vremenu
        </p>
      </div>
      <div class="d-flex gap-2">
        <router-link to="/stock" class="btn btn-outline-dark btn-sm d-flex align-items-center">
          <i class="bi bi-shield-check text-success me-1"></i> Usaglašavanje stanja
        </router-link>
        <button class="btn btn-outline-primary btn-sm" @click="loadDashboardData" :disabled="isLoading">
          <i class="bi bi-arrow-clockwise me-1" :class="{ 'spinner-border spinner-border-sm': isLoading }"></i>
          Osveži podatke
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="errorMessage" class="alert alert-danger d-flex align-items-center mb-4">
      <i class="bi bi-exclamation-octagon-fill me-2 fs-5"></i>
      <div>{{ errorMessage }}</div>
    </div>

    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Učitavanje...</span>
      </div>
      <div class="text-muted mt-2 small">Učitavanje podataka...</div>
    </div>

    <div v-else-if="stats">
      <!-- 1. KPI Kartice -->
      <div class="row g-3 mb-4">
        <!-- Skladišta -->
        <div class="col-md-6 col-xl-2 col-sm-6">
          <div class="card border-0 shadow-sm rounded-3 h-100 border-start border-primary border-4">
            <div class="card-body p-3">
              <div class="text-muted small fw-semibold text-uppercase">Skladišta</div>
              <div class="fs-3 fw-bold text-dark my-1">{{ stats.kpis.total_warehouses }}</div>
              <div class="small text-muted">Beograd, Niš, Vršac</div>
            </div>
          </div>
        </div>

        <!-- Artikli -->
        <div class="col-md-6 col-xl-2 col-sm-6">
          <div class="card border-0 shadow-sm rounded-3 h-100 border-start border-info border-4">
            <div class="card-body p-3">
              <div class="text-muted small fw-semibold text-uppercase">Katalog artikala</div>
              <div class="fs-3 fw-bold text-dark my-1">{{ stats.kpis.total_products }}</div>
              <div class="small text-muted">Aktivnih artikala</div>
            </div>
          </div>
        </div>

        <!-- Ukupno knjiženja u Ledgeru -->
        <div class="col-md-6 col-xl-2 col-sm-6">
          <div class="card border-0 shadow-sm rounded-3 h-100 border-start border-primary border-4">
            <div class="card-body p-3">
              <div class="text-muted small fw-semibold text-uppercase">Ukupno promena</div>
              <div class="fs-3 fw-bold text-dark my-1">{{ stats.kpis.total_movements }}</div>
              <div class="small text-muted">Evidentiranih promena</div>
            </div>
          </div>
        </div>

        <!-- Vrednost celokupnog lagera -->
        <div class="col-md-6 col-xl-3 col-sm-6">
          <div class="card border-0 shadow-sm rounded-3 h-100 border-start border-success border-4">
            <div class="card-body p-3">
              <div class="text-muted small fw-semibold text-uppercase">Ukupna vrednost lagera</div>
              <div class="fs-4 fw-bold text-success my-1">{{ formatCurrency(stats.kpis.total_inventory_value) }}</div>
              <div class="small text-muted">Procena po nabavnoj ceni</div>
            </div>
          </div>
        </div>

        <!-- Kritične zalihe -->
        <div class="col-md-12 col-xl-3 col-sm-12">
          <div
            class="card border-0 shadow-sm rounded-3 h-100 border-start border-4"
            :class="stats.kpis.critical_stock_count > 0 ? 'border-danger bg-danger-subtle' : 'border-secondary'"
          >
            <div class="card-body p-3">
              <div class="text-muted small fw-semibold text-uppercase">Kritične zalihe</div>
              <div class="fs-3 fw-bold my-1" :class="stats.kpis.critical_stock_count > 0 ? 'text-danger' : 'text-dark'">
                {{ stats.kpis.critical_stock_count }}
              </div>
              <div class="small" :class="stats.kpis.critical_stock_count > 0 ? 'text-danger' : 'text-muted'">
                {{ stats.kpis.critical_stock_count > 0 ? 'Potrebna dopuna zaliha!' : 'Sve zalihe su optimalne' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Raspodela zaliha i finansijske vrednosti po lokacijama (Beograd, Niš, Vršac) -->
      <div class="row g-4 mb-4">
        <div class="col-lg-4" v-for="wh in stats.warehouse_stats" :key="wh.id">
          <div class="card border-0 shadow-sm rounded-3 h-100">
            <div class="card-body p-4">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <span class="badge bg-light text-primary border mb-1">{{ wh.code }}</span>
                  <h5 class="fw-bold mb-0">{{ wh.name }}</h5>
                  <span class="text-muted small"><i class="bi bi-geo-alt me-1"></i>{{ wh.city }}</span>
                </div>
                <div class="p-2 bg-primary bg-opacity-10 text-primary rounded">
                  <i class="bi bi-building fs-4"></i>
                </div>
              </div>
              <hr class="my-3 text-muted opacity-25" />
              <div class="mb-3">
                <div class="small text-muted">Vrednost zaliha na lokaciji:</div>
                <div class="fs-4 fw-bold text-success">{{ formatCurrency(wh.total_inventory_value) }}</div>
              </div>
              <div class="row text-center pt-2 border-top">
                <div class="col-6 border-end">
                  <div class="small text-muted">Artikala na stanju</div>
                  <div class="fs-5 fw-bold text-primary">{{ wh.distinct_products_count }} artikala</div>
                </div>
                <div class="col-6">
                  <div class="small text-muted">Dnevnik knjiženja</div>
                  <div class="fs-5 fw-bold text-dark">{{ wh.total_movements }} promena</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4">
        <!-- 3. Tabela kritičnih zaliha -->
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm rounded-3 h-100">
            <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
              <h6 class="fw-bold mb-0 text-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>Upozorenja: Kritične zalihe
              </h6>
              <router-link to="/products" class="btn btn-sm btn-outline-secondary">
                Svi artikli <i class="bi bi-arrow-right ms-1"></i>
              </router-link>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                  <thead class="table-light small">
                    <tr>
                      <th>Šifra (SKU)</th>
                      <th>Naziv artikla</th>
                      <th class="text-center">Stanje</th>
                      <th class="text-center">Min. prag</th>
                      <th class="text-end">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="stats.low_stock_products.length === 0">
                      <td colspan="5" class="text-center py-4 text-success">
                        <i class="bi bi-check-circle fs-4 d-block mb-1"></i>
                        Svi artikli imaju optimalne količine na zalihama.
                      </td>
                    </tr>
                    <tr v-for="item in stats.low_stock_products" :key="item.id">
                      <td><span class="badge bg-secondary font-monospace">{{ item.sku }}</span></td>
                      <td class="fw-medium">{{ item.name }}</td>
                      <td class="text-center fw-bold text-danger">{{ item.current_stock }} {{ item.unit_of_measure }}</td>
                      <td class="text-center text-muted">{{ item.min_threshold }}</td>
                      <td class="text-end">
                        <StatusBadge type="stock" :value="item.is_out_of_stock ? 'NEMA NA STANJU' : 'KRITIČNO'" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Poslednja knjiženja (Dnevnik) -->
        <div class="col-lg-6">
          <div class="card border-0 shadow-sm rounded-3 h-100">
            <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
              <h6 class="fw-bold mb-0">
                <i class="bi bi-clock-history me-2 text-primary"></i>Poslednja knjiženja
              </h6>
              <router-link to="/stock" class="btn btn-sm btn-outline-secondary">
                Dnevnik promena <i class="bi bi-arrow-right ms-1"></i>
              </router-link>
            </div>
            <div class="card-body p-0">
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                  <thead class="table-light small">
                    <tr>
                      <th>Tip</th>
                      <th>Artikal</th>
                      <th>Skladište</th>
                      <th class="text-center">Količina</th>
                      <th class="text-end">Vreme</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="stats.recent_movements.length === 0">
                      <td colspan="5" class="text-center py-4 text-muted">
                        Nema zabeleženih promena zaliha.
                      </td>
                    </tr>
                    <tr v-for="mov in stats.recent_movements" :key="mov.id">
                      <td>
                        <StatusBadge type="movement" :value="mov.movement_type" />
                      </td>
                      <td>
                        <div class="fw-medium small">{{ mov.product_name }}</div>
                        <div class="text-muted" style="font-size: 0.75rem;">{{ mov.product_sku }}</div>
                      </td>
                      <td class="small">{{ mov.warehouse_city }}</td>
                      <td class="text-center fw-bold">{{ mov.quantity }} {{ mov.unit_of_measure }}</td>
                      <td class="text-end text-muted small">{{ formatDate(mov.movement_date) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
