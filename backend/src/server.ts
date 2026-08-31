import app from './app';
import { ENV } from './config/env';
import { testDbConnection } from './config/db';

async function startServer() {
  console.log('🚀 Pokretanje SEP-MM backend servera...');
  
  // Provera konekcije sa bazom podataka
  await testDbConnection();

  app.listen(ENV.PORT, () => {
    console.log(`📡 Server je aktivan na: http://localhost:${ENV.PORT}`);
    console.log(`📚 API rute dostupne na: http://localhost:${ENV.PORT}/api`);
  });
}

startServer();
