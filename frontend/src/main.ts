import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

// Uvoz Bootstrap 5 CSS i JavaScript paketa
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'bootstrap-icons/font/bootstrap-icons.css';

const app = createApp(App);

app.use(router);

app.mount('#app');
