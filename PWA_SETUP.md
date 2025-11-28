# Progressive Web App (PWA) Setup

BuzzMaster är nu konfigurerad som en Progressive Web App! 🎉

## ✅ Vad som är klart:

- ✅ **Manifest.json** - PWA-konfiguration
- ✅ **Service Worker** - Offline-stöd och caching
- ✅ **Install Prompt** - Användare kan installera appen
- ✅ **PWA Meta Tags** - Apple och Android-stöd
- ✅ **Viewport Configuration** - Mobil-optimerad

## 📱 Saknas: App-ikoner

Du behöver skapa två app-ikoner:

### Krav:
1. **icon-192.png** - 192x192 pixels
2. **icon-512.png** - 512x512 pixels

### Design-tips:
- Använd en fyrkantig design (kvadratisk)
- Enkelt, igenkännbart motiv (t.ex. fotboll + frågetecken)
- Bra kontrast
- Ingen text (ser dåligt ut på små ikoner)
- Färger som matchar appen (#3b82f6 = blue)

### Placering:
Lägg ikonerna i `/public/`:
```
public/
  icon-192.png
  icon-512.png
```

## 🎨 Snabb lösning med AI:

Be en AI generera ikoner:
> "Create a 512x512 app icon for a quiz game called BuzzMaster. 
> Modern, minimalist design with a football and question mark. 
> Blue theme (#3b82f6), no text, flat design."

Eller använd tjänster som:
- https://realfavicongenerator.net/
- https://www.favicon-generator.org/

## 🧪 Testa PWA:

1. **Desktop (Chrome/Edge):**
   - Öppna `https://buzz.healthymountain.org`
   - Se efter install-ikonen i adressfältet (⊕)
   - Eller se popup i nedre högra hörnet

2. **Mobile (iOS Safari):**
   - Öppna i Safari
   - Tryck "Share" → "Add to Home Screen"

3. **Mobile (Android Chrome):**
   - Öppna i Chrome
   - Se install-banner
   - Eller: Meny → "Install app"

## 🔧 Funktioner:

- **Offline-stöd**: Appen laddar även utan internet
- **App-liknande**: Fullskärm utan webbläsare-UI
- **Snabb**: Caching för snabbare laddning
- **Home Screen**: Egen ikon på hemskärmen
- **Push Notifications**: (Kan läggas till senare)

## 📊 Service Worker Caching:

### Vad cachas:
- Root-sidan (/)
- Manifest
- Ikoner
- Statiska filer

### Vad cachas INTE:
- API-anrop (/api/*)
- WebSocket (/ws)
- Dynamisk data

Detta säkerställer att appen alltid visar färsk data!

---

**Efter att du lagt till ikoner: Commit, push, och testa på mobil!** 🚀
