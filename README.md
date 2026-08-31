# SEP-MM — Sistemi e-Poslovanja Materials Management

---

## 1. Pregled projekta

SEP-MM je web aplikacija kreirana po ugledu na ERP module SAP S/4HANA (Materials Management i Warehouse Management).

Aplikacija implementira Dual-Ledger i Snapshot arhitekturu:
1. stock_movements: Dnevnik u koji se beleži svaka pojedinačna promena zaliha (101 Prijem, 201 Izdavanje, 301 Međuskladišni prenos, 551 Rashod).
2. current_stock: Trenutno stanje po artiklu i skladištu radi brzog očitavanja bez opterećenja servera.
3. Transakcije (ACID): Svako knjiženje zaključava red u snapshot tabeli (SELECT FOR UPDATE), proverava raspoloživost zaliha i vrši izmene unutar iste transakcije (BEGIN, COMMIT, ROLLBACK).
4. Rekoncilijacija: Mehanizam koji proverava usaglašenost računanjem zbira iz dnevnika i stanja u snapshot tabeli i signalizira odstupanja.

---

## 2. Relacioni model baze podataka (MySQL 8.0)

Baza se sastoji od 5 tabela:

1. users — Korisnički nalozi sa hešovanim lozinkama (bcryptjs) i ulogama (ADMIN, MAGACIONER).
2. warehouses — Skladišne lokacije sa predefinisanim sedištima:
   - WH-BG-01 — Glavni distributivni centar Beograd
   - WH-NI-01 — Regionalni magacin Niš
   - WH-VS-01 — Pogonsko skladište Vršac
   - WH-NS-01 — Logistički centar Novi Sad
3. products — Katalog artikala i materijala sa šifrom (SKU), cenom, jedinicom mere i minimalnim pragom za alarm.
4. stock_movements — Dnevnik promena povezan preko 3 spoljna ključa (product_id, warehouse_id, user_id).
5. current_stock — Trenutno stanje po artiklu i skladištu sa UNIQUE(product_id, warehouse_id).

---

## 3. Standardne vrste kretanja materijala

- 101_INBOUND: Prijem robe od dobavljača (ulaz nove robe na skladište, povećava zalihe).
- 201_OUTBOUND: Izdavanje robe za nalog ili kupca (izlaz materijala sa skladišta, smanjuje zalihe).
- 301_TRANSFER: Međuskladišni prenos (premeštanje robe sa jednog na drugo skladište, smanjuje na izvoru, povećava na cilju).
- 551_SCRAP: Rashod ili otpis oštećene robe (izlaz robe usled oštećenja ili kvara, smanjuje zalihe).

---

## 4. Uputstvo za pokretanje (Setup)

Korak 1: Pokretanje MySQL baze putem Docker-a
```bash
docker compose up -d
```
Kontejner automatski startuje MySQL 8.0 server i izvršava database/schema.sql sa svim tabelama i seed podacima.

Korak 2: Pokretanje Backend servera
```bash
cd backend
npm run dev
```
Server je aktivan na http://localhost:5000 (API na http://localhost:5000/api).

Korak 3: Pokretanje Frontend aplikacije
```bash
cd frontend
npm run dev
```
Frontend aplikacija se otvara na http://localhost:3000.

---

## 5. Testni nalozi za prijavu (Seed podaci)

- Administrator: admin@sep-mm.rs / admin123 (Pristup svim skladištima, artiklima, knjiženjima i rekoncilijaciji)
- Magacioner: marko@sep-mm.rs / admin123 (Knjiženje prijema 101, izdavanja 201, prenosa 301 i otpisa 551)

---

## 6. Automatsko testiranje

1. Backend REST API i transakcioni testovi:
```bash
cd backend
npm test
```

2. Frontend Vitest unit testovi:
```bash
cd frontend
npm test
```