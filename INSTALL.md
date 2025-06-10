# Guida all'installazione di homebridge-elmo

Questa guida fornisce istruzioni dettagliate su come installare e configurare il plugin homebridge-elmo.

## Prerequisiti

Prima di installare il plugin, assicurati di avere:

1. **Homebridge**: Il plugin richiede Homebridge v1.3.0 o superiore. Se non hai ancora installato Homebridge, segui la [guida ufficiale](https://github.com/homebridge/homebridge/wiki).

2. **Node.js**: È richiesto Node.js v14 o superiore. Puoi verificare la tua versione con il comando:
   ```bash
   node --version
   ```

3. **Python**: È richiesto Python 3.6 o superiore. Puoi verificare la tua versione con il comando:
   ```bash
   python3 --version
   ```

4. **Pip**: È necessario per installare le dipendenze Python. Puoi verificare la tua versione con il comando:
   ```bash
   pip3 --version
   ```

5. **Sistema di antifurto Elmo**: Devi avere un sistema di antifurto Elmo con accesso alle API cloud. Assicurati di avere le credenziali di accesso (username, password e codice).

## Installazione

### Metodo 1: Installazione tramite l'interfaccia web di Homebridge

1. Apri l'interfaccia web di Homebridge
2. Vai alla scheda "Plugins"
3. Cerca "homebridge-elmo"
4. Clicca su "Install"

### Metodo 2: Installazione tramite npm

1. Apri un terminale
2. Esegui il seguente comando:
   ```bash
   npm install -g homebridge-elmo
   ```

### Metodo 3: Installazione manuale

1. Clona il repository:
   ```bash
   git clone https://github.com/BlackHole12X/homebridge-elmo.git
   ```

2. Entra nella directory del plugin:
   ```bash
   cd homebridge-elmo
   ```

3. Installa le dipendenze:
   ```bash
   npm install
   ```

4. Collega il plugin a Homebridge:
   ```bash
   npm link
   ```

5. Nella directory di Homebridge, collega il plugin:
   ```bash
   cd ~/.homebridge
   npm link homebridge-elmo
   ```

## Configurazione

### Metodo 1: Configurazione tramite l'interfaccia web di Homebridge

1. Apri l'interfaccia web di Homebridge
2. Vai alla scheda "Plugins"
3. Trova "homebridge-elmo" e clicca su "Settings"
4. Compila i campi richiesti:
   - **Nome**: Nome del dispositivo nell'app Casa
   - **Username**: Username per accedere al sistema Elmo
   - **Password**: Password per accedere al sistema Elmo
   - **Codice**: Codice numerico per armare/disarmare il sistema
   - **Sistema**: Tipo di sistema Elmo (`e-connect` o `metronet`)
   - **Dominio**: Dominio utilizzato per accedere alla pagina di login via web
   - **Intervallo di polling**: Intervallo in secondi tra le richieste di aggiornamento dello stato
   - **Debug**: Abilita i log di debug
5. Clicca su "Save"

### Metodo 2: Configurazione manuale

1. Apri il file di configurazione di Homebridge:
   ```bash
   nano ~/.homebridge/config.json
   ```

2. Aggiungi la seguente configurazione nella sezione `platforms`:
   ```json
   {
     "platforms": [
       {
         "platform": "ElmoSecuritySystem",
         "name": "Elmo Security System",
         "username": "il_tuo_username",
         "password": "la_tua_password",
         "code": "il_tuo_codice",
         "system": "e-connect",
         "domain": "default",
         "pollInterval": 30,
         "debug": false
       }
     ]
   }
   ```

3. Sostituisci `il_tuo_username`, `la_tua_password` e `il_tuo_codice` con le tue credenziali reali.

4. Salva il file e chiudi l'editor.

## Parametri di configurazione

| Parametro | Tipo | Obbligatorio | Predefinito | Descrizione |
|-----------|------|--------------|-------------|-------------|
| `name` | string | No | `Elmo Security System` | Nome del dispositivo nell'app Casa |
| `username` | string | Sì | - | Username per accedere al sistema Elmo |
| `password` | string | Sì | - | Password per accedere al sistema Elmo |
| `code` | string | Sì | - | Codice numerico per armare/disarmare il sistema |
| `system` | string | No | `e-connect` | Tipo di sistema Elmo (`e-connect` o `metronet`) |
| `domain` | string | No | `default` | Dominio utilizzato per accedere alla pagina di login via web |
| `pollInterval` | number | No | `30` | Intervallo in secondi tra le richieste di aggiornamento dello stato |
| `debug` | boolean | No | `false` | Abilita i log di debug |
| `homeSectors` | string | No | `""` | Settori da armare in modalità Casa (es: "1,3") |
| `awaySectors` | string | No | `""` | Settori da armare in modalità Via (es: "1,2,3") |
| `nightSectors` | string | No | `""` | Settori da armare in modalità Notte (es: "2,3") |

### Configurazione dei settori

Il plugin permette di configurare quali settori del sistema Elmo devono essere armati per ogni modalità:

- **Modalità Casa**: Tipicamente settori perimetrali (porte e finestre)
- **Modalità Via**: Tutti i settori del sistema
- **Modalità Notte**: Settori perimetrali e alcune zone interne

**Esempi di configurazione settori**:

```json
{
  "homeSectors": "1,3",     // Arma solo settori 1 e 3 in modalità Casa
  "awaySectors": "1,2,3",   // Arma tutti i settori in modalità Via  
  "nightSectors": "2,3"     // Arma settori 2 e 3 in modalità Notte
}
```

**Note importanti**:
- Se lasci un campo vuoto (es: `""`), quella modalità armerà tutti i settori disponibili
- I numeri dei settori devono essere separati da virgole
- Non utilizzare spazi tra i numeri (corretto: "1,2,3", sbagliato: "1, 2, 3")
- I settori devono esistere nel tuo sistema Elmo

## Verifica dell'installazione

1. Riavvia Homebridge:
   ```bash
   sudo systemctl restart homebridge
   ```

2. Verifica i log di Homebridge per assicurarti che il plugin si sia avviato correttamente:
   ```bash
   tail -f ~/.homebridge/homebridge.log
   ```

3. Apri l'app Casa di Apple sul tuo dispositivo iOS
4. Verifica che il sistema di sicurezza appaia nell'app
5. Verifica che lo stato del sistema (armato/disarmato) corrisponda allo stato reale del sistema Elmo

## Risoluzione dei problemi

### Problema: Il plugin non appare in Homebridge

**Soluzione**:
- Verifica che il plugin sia installato correttamente
- Riavvia Homebridge
- Verifica i log di Homebridge per eventuali errori

### Problema: Errore di autenticazione

**Soluzione**:
- Verifica che le credenziali siano corrette
- Assicurati che il sistema Elmo sia raggiungibile e funzionante
- Verifica che il dominio sia corretto

### Problema: Lo stato del sistema non si aggiorna

**Soluzione**:
- Verifica che l'intervallo di polling sia impostato correttamente
- Assicurati che il sistema Elmo sia raggiungibile e funzionante
- Abilita la modalità debug per ottenere più informazioni

### Problema: Errore durante l'installazione delle dipendenze Python

**Soluzione**:
- Verifica che Python e pip siano installati correttamente
- Prova a installare manualmente le dipendenze:
  ```bash
  pip3 install requests econnect-python
  ```

## Supporto

Se hai bisogno di aiuto, puoi:
- Creare una issue su GitHub
- Consultare la documentazione ufficiale
- Contattare il supporto tecnico di Elmo per problemi relativi al sistema di antifurto

