# homebridge-elmo

Plugin Homebridge per integrare i sistemi di antifurto Elmo con HomeKit.

## Descrizione

Questo plugin permette di controllare il tuo sistema di antifurto Elmo tramite l'app Casa di Apple. Supporta le seguenti funzionalità:

- Visualizzazione dello stato del sistema (armato/disarmato)
- Armamento e disarmamento del sistema
- Supporto per diverse modalità di armamento (Casa, Via, Notte)
- Configurazione personalizzata dei settori per ogni modalità

## Sistemi supportati

- Elmo e-Connect
- IESS Metronet

## Requisiti

- Homebridge v1.3.0 o superiore
- Node.js v14 o superiore
- Python 3.6 o superiore
- Un sistema di antifurto Elmo con accesso alle API cloud

## Installazione

1. Installa Homebridge (se non l'hai già fatto)
2. Installa questo plugin tramite l'interfaccia web di Homebridge o con il comando:

```bash
npm install -g homebridge-elmo
```

3. Configura il plugin tramite l'interfaccia web di Homebridge o modificando manualmente il file `config.json`

## Configurazione

Ecco un esempio di configurazione:

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

### Parametri di configurazione

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

## Come funziona

Il plugin utilizza la libreria Python `econnect-python` per comunicare con le API cloud di Elmo. Quando viene avviato, il plugin installa automaticamente le dipendenze Python necessarie e crea gli script per comunicare con il sistema Elmo.

Il plugin esegue un polling periodico per aggiornare lo stato del sistema e reagisce ai comandi inviati dall'app Casa.

## Risoluzione dei problemi

Se riscontri problemi con il plugin, prova a:

1. Abilitare la modalità debug impostando `debug: true` nella configurazione
2. Verificare i log di Homebridge per eventuali errori
3. Assicurarsi che le credenziali siano corrette
4. Verificare che il sistema Elmo sia raggiungibile e funzionante


## Crediti

Questo plugin è fortemente ispirato dall'integrazione di Elmo per Home Assistant di [palazzem](https://github.com/palazzem), e utilizza la sua libreria [econnect-python](https://pypi.org/project/econnect-python/) per interagire con il sistema Elmo.