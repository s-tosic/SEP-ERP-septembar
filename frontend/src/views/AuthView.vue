<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const router = useRouter();
const { login, register } = useAuth();

const isLoginMode = ref(true);
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

// Form polja
const email = ref('admin@sep-mm.rs');
const password = ref('admin123');
const name = ref('');
const role = ref<'ADMIN' | 'MAGACIONER'>('MAGACIONER');

async function handleSubmit() {
  errorMessage.value = '';
  successMessage.value = '';
  isLoading.value = true;

  if (isLoginMode.value) {
    const res = await login(email.value, password.value);
    isLoading.value = false;
    if (res.success) {
      successMessage.value = 'Uspešna prijava! Preusmeravanje na kontrolnu tablu...';
      router.push('/dashboard');
    } else {
      errorMessage.value = res.message || 'Neuspešna prijava. Proverite da li je backend server pokrenut.';
    }
  } else {
    const res = await register(name.value, email.value, password.value, role.value);
    isLoading.value = false;
    if (res.success) {
      successMessage.value = 'Registracija uspešna! Preusmeravanje...';
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } else {
      errorMessage.value = res.message || 'Neuspešna registracija.';
    }
  }
}
</script>

<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-md-6 col-lg-5">
        <div class="text-center mb-4">
          <div class="d-inline-flex p-3 bg-primary bg-opacity-10 text-primary rounded-circle mb-3">
            <i class="bi bi-boxes fs-1"></i>
          </div>
          <h2 class="fw-bold">SEP-<span class="text-primary">MM</span></h2>
          <p class="text-muted small">
            Sistemi e-Poslovanja — Upravljanje materijalima i skladištima
          </p>
        </div>

        <div class="card shadow-sm border-0 rounded-3">
          <div class="card-header bg-white border-bottom-0 pt-4 px-4 pb-0">
            <ul class="nav nav-pills nav-fill">
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: isLoginMode }"
                  @click="isLoginMode = true; errorMessage = '';"
                  type="button"
                >
                  <i class="bi bi-box-arrow-in-right me-1"></i> Prijava
                </button>
              </li>
              <li class="nav-item">
                <button
                  class="nav-link"
                  :class="{ active: !isLoginMode }"
                  @click="isLoginMode = false; errorMessage = '';"
                  type="button"
                >
                  <i class="bi bi-person-plus me-1"></i> Registracija
                </button>
              </li>
            </ul>
          </div>

          <div class="card-body p-4">
            <!-- Obaveštenja -->
            <div v-if="errorMessage" class="alert alert-danger py-2 small d-flex align-items-center mb-3">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              <span>{{ errorMessage }}</span>
            </div>
            <div v-if="successMessage" class="alert alert-success py-2 small d-flex align-items-center mb-3">
              <i class="bi bi-check-circle-fill me-2"></i>
              <span>{{ successMessage }}</span>
            </div>

            <form @submit.prevent="handleSubmit">
              <!-- Polje za Ime (samo registracija) -->
              <div class="mb-3" v-if="!isLoginMode">
                <label class="form-label small fw-semibold">Ime i prezime</label>
                <div class="input-group">
                  <span class="input-group-text bg-light"><i class="bi bi-person text-muted"></i></span>
                  <input
                    type="text"
                    v-model="name"
                    class="form-control"
                    placeholder="npr. Nikola Jovanović"
                    required
                  />
                </div>
              </div>

              <!-- Email -->
              <div class="mb-3">
                <label class="form-label small fw-semibold">Email adresa</label>
                <div class="input-group">
                  <span class="input-group-text bg-light"><i class="bi bi-envelope text-muted"></i></span>
                  <input
                    type="email"
                    v-model="email"
                    class="form-control"
                    placeholder="admin@sep-mm.rs"
                    required
                  />
                </div>
              </div>

              <!-- Lozinka -->
              <div class="mb-3">
                <label class="form-label small fw-semibold">Lozinka</label>
                <div class="input-group">
                  <span class="input-group-text bg-light"><i class="bi bi-key text-muted"></i></span>
                  <input
                    type="password"
                    v-model="password"
                    class="form-control"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <!-- Uloga (samo registracija) -->
              <div class="mb-4" v-if="!isLoginMode">
                <label class="form-label small fw-semibold">Uloga u sistemu</label>
                <select v-model="role" class="form-select">
                  <option value="MAGACIONER">Magacioner (Prijem i otprema robe)</option>
                  <option value="ADMIN">Administrator (Puni pristup sistemu)</option>
                </select>
              </div>

              <!-- Submit dugme -->
              <button
                type="submit"
                class="btn btn-primary w-100 py-2 fw-semibold d-flex justify-content-center align-items-center"
                :disabled="isLoading"
              >
                <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
                <span>{{ isLoginMode ? 'Prijavi se na sistem' : 'Kreiraj nalog' }}</span>
              </button>
            </form>
          </div>
        </div>

        <div class="text-center mt-3 text-muted small">
          SEP-MM 2026
        </div>
      </div>
    </div>
  </div>
</template>
