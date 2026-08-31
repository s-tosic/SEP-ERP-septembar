<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const route = useRoute();
const { user, isAuthenticated, logout } = useAuth();

function handleLogout() {
  logout();
  router.push('/auth');
}
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm sticky-top">
    <div class="container-fluid px-4">
      <router-link to="/dashboard" class="navbar-brand d-flex align-items-center fw-bold text-primary">
        <i class="bi bi-boxes fs-4 me-2 text-warning"></i>
        <span>SEP-<span class="text-white fw-light fs-6">MM</span></span>
      </router-link>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarMain"
        aria-controls="navbarMain"
        aria-expanded="false"
        aria-label="Navigacija"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navbarMain">
        <!-- Glavna navigacija -->
        <ul class="navbar-nav me-auto mb-2 mb-lg-0" v-if="isAuthenticated">
          <li class="nav-item">
            <router-link
              to="/dashboard"
              class="nav-link"
              :class="{ active: route.path === '/dashboard' }"
            >
              <i class="bi bi-speedometer2 me-1"></i> Kontrolna tabla
            </router-link>
          </li>
          <li class="nav-item">
            <router-link
              to="/warehouses"
              class="nav-link"
              :class="{ active: route.path === '/warehouses' }"
            >
              <i class="bi bi-buildings me-1"></i> Skladišta (Lokacije)
            </router-link>
          </li>
          <li class="nav-item">
            <router-link
              to="/products"
              class="nav-link"
              :class="{ active: route.path === '/products' }"
            >
              <i class="bi bi-box-seam me-1"></i> Artikli i Materijali
            </router-link>
          </li>
          <li class="nav-item">
            <router-link
              to="/stock"
              class="nav-link"
              :class="{ active: route.path === '/stock' }"
            >
              <i class="bi bi-arrow-left-right me-1"></i> Dnevnik zaliha (Promet)
            </router-link>
          </li>
        </ul>

        <!-- Profil i odjava -->
        <div class="d-flex align-items-center" v-if="isAuthenticated">
          <div class="me-3 text-end d-none d-md-block">
            <div class="text-white small fw-semibold">{{ user?.name }}</div>
            <span class="badge bg-secondary text-uppercase" style="font-size: 0.65rem;">
              {{ user?.role }}
            </span>
          </div>
          <button
            @click="handleLogout"
            class="btn btn-outline-danger btn-sm d-flex align-items-center"
            title="Odjavi se sa sistema"
          >
            <i class="bi bi-box-arrow-right me-1"></i> Odjavi se
          </button>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.nav-link {
  font-weight: 500;
  transition: color 0.15s ease-in-out;
}
.nav-link.active {
  color: #0d6efd !important;
}
</style>
