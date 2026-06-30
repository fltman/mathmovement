# MatteRörelse

[![Support me on Patreon](https://img.shields.io/badge/Patreon-Support%20my%20work-FF424D?style=flat&logo=patreon&logoColor=white)](https://www.patreon.com/AndersBjarby)

Lös matteuppgifter med kroppen! En webbapp där barn fotar en sida ur matteboken, varpå en AI läser av additions- och subtraktionsuppgifter (uppställning). Sedan löser man dem framför webbkameran genom att "nypa" och dra rätt siffror på plats med handen — handrörelser spåras med MediaPipe Hands.

## Vad den gör

- **Fota matteboken** — ta kort med kameran, välj en bild, eller prova med exempeltal.
- **AI-avläsning (OCR)** — bilden skickas till OpenRouter (modell `anthropic/claude-sonnet-4-6`) som extraherar additions- och subtraktionsuppgifter som JSON.
- **Spela med kroppen** — webbkameran blir spelplan; MediaPipe Hands spårar båda händerna och en nyp-gest (tumme + pekfinger) används för att greppa siffror.
- **Uppställning med lån** — kolumnberäkning med stöd för lån vid subtraktion, fyrverkerier vid rätt svar och feedback.
- **Rapport** — sammanställning av lösta uppgifter som går att skriva ut.

## Användning

Statisk webbapp. Kopiera config-filen och lägg in din OpenRouter-nyckel:

```bash
cp js/config.example.js js/config.js
# redigera js/config.js och fyll i OPENROUTER_API_KEY
```

Servera mappen statiskt (kamera kräver HTTPS eller localhost):

```bash
python3 -m http.server 8000
```

Öppna sedan `http://localhost:8000`.

## Teknik

Vanilla HTML/CSS/JS (ES-moduler), MediaPipe Hands för handspårning, OpenRouter (Claude Sonnet) för bildavläsning.
