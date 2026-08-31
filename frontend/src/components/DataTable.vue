<script setup lang="ts">
import { ref, computed } from 'vue';

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
}

const props = withDefaults(
  defineProps<{
    columns: Column[];
    items: any[];
    searchPlaceholder?: string;
    showSearch?: boolean;
  }>(),
  {
    searchPlaceholder: 'Pretraži podatke...',
    showSearch: true,
  }
);

const searchQuery = ref('');
const sortKey = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('asc');

function setSort(key: string) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
}

const filteredItems = computed(() => {
  let result = [...props.items];

  // Pretraga
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    result = result.filter((item) =>
      Object.values(item).some(
        (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      )
    );
  }

  // Sortiranje
  if (sortKey.value) {
    result.sort((a, b) => {
      const aVal = a[sortKey.value];
      const bVal = b[sortKey.value];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder.value === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return sortOrder.value === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }

  return result;
});
</script>

<template>
  <div class="card shadow-sm border-0 mb-4">
    <div class="card-header bg-white py-3" v-if="showSearch || $slots.headerActions">
      <div class="row g-2 align-items-center">
        <div class="col-md-6" v-if="showSearch">
          <div class="input-group">
            <span class="input-group-text bg-light border-end-0">
              <i class="bi bi-search text-muted"></i>
            </span>
            <input
              type="text"
              v-model="searchQuery"
              class="form-control border-start-0 ps-0"
              :placeholder="searchPlaceholder"
            />
          </div>
        </div>
        <div class="col-md-6 text-md-end" v-if="$slots.headerActions">
          <slot name="headerActions"></slot>
        </div>
      </div>
    </div>

    <div class="card-body p-0">
      <div class="table-responsive">
        <table class="table table-hover table-striped align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th
                v-for="col in columns"
                :key="col.key"
                @click="col.sortable ? setSort(col.key) : null"
                :style="{ cursor: col.sortable ? 'pointer' : 'default' }"
                class="user-select-none text-nowrap"
              >
                {{ col.label }}
                <i
                  v-if="col.sortable"
                  class="bi ms-1"
                  :class="{
                    'bi-arrow-down-up text-muted': sortKey !== col.key,
                    'bi-arrow-up-short text-primary': sortKey === col.key && sortOrder === 'asc',
                    'bi-arrow-down-short text-primary': sortKey === col.key && sortOrder === 'desc',
                  }"
                ></i>
              </th>
              <th v-if="$slots.actions" class="text-end px-3">Akcije</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredItems.length === 0">
              <td :colspan="columns.length + ($slots.actions ? 1 : 0)" class="text-center py-4 text-muted">
                <i class="bi bi-inbox fs-3 d-block mb-2"></i>
                Nema podataka za prikaz.
              </td>
            </tr>
            <tr v-for="(item, idx) in filteredItems" :key="item.id || idx">
              <td v-for="col in columns" :key="col.key">
                <slot :name="col.key" :item="item" :value="item[col.key]">
                  {{ item[col.key] }}
                </slot>
              </td>
              <td v-if="$slots.actions" class="text-end px-3 text-nowrap">
                <slot name="actions" :item="item"></slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card-footer bg-white py-2 text-muted small d-flex justify-content-between">
      <span>Prikazano <strong>{{ filteredItems.length }}</strong> od ukupno <strong>{{ items.length }}</strong> zapisa</span>
      <span v-if="searchQuery.trim()">Filter primenjen</span>
    </div>
  </div>
</template>
