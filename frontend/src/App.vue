<script setup lang="ts">
import Navbar from './components/Navbar.vue';
import { useAuth } from './composables/useAuth';

const { isAuthenticated } = useAuth();
</script>

<template>
  <div class="min-vh-100 d-flex flex-column bg-light">
    <!-- Navbar je vidljiv kada je korisnik ulogovan -->
    <Navbar v-if="isAuthenticated" />

    <!-- Glavni sadržaj stranica -->
    <main class="flex-grow-1">
      <router-view />
    </main>

    <!-- Footer -->
    <footer class="bg-white border-top py-3 text-center text-muted small mt-auto" v-if="isAuthenticated">
      <div class="container-fluid px-4">
        <span>SEP-MM 2026</span>
      </div>
    </footer>
  </div>
</template>
