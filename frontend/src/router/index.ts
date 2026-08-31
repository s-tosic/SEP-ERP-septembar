import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import AuthView from '../views/AuthView.vue';
import DashboardView from '../views/DashboardView.vue';
import WarehousesView from '../views/WarehousesView.vue';
import ProductsView from '../views/ProductsView.vue';
import StockView from '../views/StockView.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/auth',
    name: 'Auth',
    component: AuthView,
    meta: { guestOnly: true },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { requiresAuth: true },
  },
  {
    path: '/warehouses',
    name: 'Warehouses',
    component: WarehousesView,
    meta: { requiresAuth: true },
  },
  {
    path: '/products',
    name: 'Products',
    component: ProductsView,
    meta: { requiresAuth: true },
  },
  {
    path: '/stock',
    name: 'Stock',
    component: StockView,
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigacioni guard za proveru JWT autentifikacije
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('sep_mm_token') || localStorage.getItem('corestock_token');
  const isAuthenticated = !!token;

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'Auth' });
  } else if (to.meta.guestOnly && isAuthenticated) {
    next({ name: 'Dashboard' });
  } else {
    next();
  }
});

export default router;
