# Eclesiar Wars Summary

Aplikacja do tworzenia podsumowań wojen z gry Eclesiar. Pozwala pobierać dane bitew z API, zapisywać je w bazie MySQL i generować podsumowania damage'u graczy.

## Struktura projektu

```
wars/
├── backend/          # Node.js Express API
│   ├── src/
│   │   ├── config/   # Konfiguracja bazy danych
│   │   ├── routes/   # Endpointy API
│   │   └── services/ # Logika biznesowa
│   └── package.json
├── frontend/         # Vue 3 + Vite + TailwindCSS
│   ├── src/
│   └── package.json
└── docs/             # Dokumentacja API
```

## Wymagania

- Node.js 18+
- MySQL 8.0+
- npm

## Instalacja

### 1. Backend

```bash
cd backend
npm install
```

### 2. Frontend

```bash
cd frontend
npm install
```

## Uruchomienie

### Backend (port 3001)

```bash
cd backend
npm run dev
```

### Frontend (port 3000)

```bash
cd frontend
npm run dev
```

Otwórz http://localhost:3000 w przeglądarce.

## Użycie

1. **Pobierz bitwę** - Wpisz ID bitwy i kliknij "Fetch Battle"
2. **Wybierz bitwy** - Zaznacz checkboxami które bitwy chcesz wliczyć do podsumowania
3. **Generuj podsumowanie** - Kliknij "Generate Summary" aby zobaczyć total damage graczy

## API Endpoints

| Method | Endpoint               | Opis                                     |
| ------ | ---------------------- | ---------------------------------------- |
| GET    | `/api/battles`         | Lista wszystkich bitew z bazy            |
| POST   | `/api/battles/fetch`   | Pobierz bitwę z Eclesiar API             |
| POST   | `/api/battles/summary` | Generuj podsumowanie dla wybranych bitew |
| DELETE | `/api/battles/:id`     | Usuń bitwę z bazy                        |

## Baza danych

Tabele:

- `battles` - Informacje o bitwach
- `rounds` - Rundy bitew (9 na bitwę)
- `hits` - Pojedyncze uderzenia graczy
- `players` - Cache nazw graczy
