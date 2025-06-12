'use strict';

const { PythonShell } = require('python-shell');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process'); // <--- aggiungi questa riga

let Service, Characteristic;

/**
 * Platform "ElmoSecuritySystem"
 */
class ElmoPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;

    // Percorso della venv
    this.venvPath = path.join(__dirname, '.venv');
    this.pythonPath = process.platform === 'win32'
      ? path.join(this.venvPath, 'Scripts', 'python.exe')
      : path.join(this.venvPath, 'bin', 'python3');

    // Crea la venv se necessario
    this.ensureVenv();

    // Installa le dipendenze Python se necessario
    this.ensurePythonDependencies();
    
    // Verifica che la configurazione sia valida
    if (!this.config) {
      this.log.error('Configurazione non valida!');
      return;
    }
    
    // Verifica che i parametri obbligatori siano presenti
    if (!this.config.username || !this.config.password || !this.config.code) {
      this.log.error('Configurazione incompleta! Sono richiesti username, password e codice.');
      return;
    }
    
    this.name = this.config.name || 'Elmo Security System';
    this.username = this.config.username;
    this.password = this.config.password;
    this.code = this.config.code;
    this.system = this.config.system || 'e-connect';
    this.domain = this.config.domain || 'default';
    this.pollInterval = this.config.pollInterval || 30;
    this.debug = this.config.debug || false;
    
    // Configurazione settori
    this.homeSectors = this.parseSectors(this.config.homeSectors);
    this.awaySectors = this.parseSectors(this.config.awaySectors);
    this.nightSectors = this.parseSectors(this.config.nightSectors);
    
    this.log.debug('Configurazione settori:');
    this.log.debug('- Casa:', this.homeSectors);
    this.log.debug('- Via:', this.awaySectors);
    this.log.debug('- Notte:', this.nightSectors);
    
    // Stato del sistema
    this.currentState = 3; // Disarmato
    this.targetState = 3; // Disarmato
    
    // Accessori
    this.accessories = [];
    

    
    // Registrazione per il completamento dell'avvio di Homebridge
    this.api.on('didFinishLaunching', () => {
      this.log.debug('didFinishLaunching');
      this.createAccessories(); // Aggiungi questa linea
      this.setupPolling();
    });
  }
  
  
  /**
   * Configura il polling per aggiornare lo stato del sistema
   */
  setupPolling() {
    this.log.debug('Configurazione del polling');
    
    // Avvia il polling
    this.pollElmoStatus();
    
    // Imposta il polling periodico
    setInterval(() => {
      this.pollElmoStatus();
    }, this.pollInterval * 1000);
  }
  
  /**
   * Esegue il polling dello stato del sistema Elmo
   */
  pollElmoStatus() {
    this.log.debug('Polling dello stato del sistema Elmo');

    const pythonScript = path.join(__dirname, 'scripts', 'elmo_client.py');
    const options = {
      mode: 'json',
      pythonPath: this.pythonPath, // Usa il python del venv
      args: [
        'status',
        this.username,
        this.password,
        this.system,
        this.domain
      ]
    };

    if (this.debug) {
      options.args.push('--debug');
    }

    PythonShell.run(pythonScript, options, (err, results) => {
      if (err) {
        this.log.error('Errore durante il polling dello stato:', err);
        return;
      }
      
      if (!results || results.length === 0) {
        this.log.error('Nessun risultato dal polling dello stato');
        return;
      }
      
      const result = results[0];
      
      if (!result.success) {
        this.log.error('Errore nel polling dello stato:', result.message);
        return;
      }
      
      this.log.debug('Stato del sistema ottenuto con successo');
      
      // Aggiorna lo stato del sistema
      this.updateSystemState(result.status);
    });
  }
  
  /**
   * Analizza la stringa dei settori e restituisce un array di numeri
   * @param {string} sectorsString - Stringa dei settori separati da virgola
   * @returns {Array|null} Array di numeri o null se vuoto
   */
  parseSectors(sectorsString) {
    if (!sectorsString || sectorsString.trim() === '') {
      return null; // null significa tutti i settori
    }
    
    return sectorsString.split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n > 0);
  }
  
  /**
   * Aggiorna lo stato del sistema in base ai dati ricevuti
   * @param {Object} status - Stato del sistema
   */
  updateSystemState(status) {
    if (!status || !status.sectors) {
      this.log.error('Dati di stato non validi');
      return;
    }
    
    this.log.debug('Aggiornamento dello stato del sistema');
    this.log.debug('Dati settori ricevuti:', JSON.stringify(status.sectors));
    
    // Converti i settori in un formato standardizzato
    let sectorsArray = [];
    
    if (Array.isArray(status.sectors)) {
      sectorsArray = status.sectors;
    } else if (typeof status.sectors === 'object' && status.sectors !== null) {
      // Converti oggetto in array
      sectorsArray = Object.values(status.sectors);
    } else {
      this.log.error('Formato settori non riconosciuto');
      return;
    }
    
    this.log.debug('Settori normalizzati:', JSON.stringify(sectorsArray));
    
    // Determina lo stato del sistema in base ai settori configurati
    const armedSectors = sectorsArray.filter(sector => sector && sector.status).map(s => s.element);
    this.log.debug('Settori armati:', armedSectors);
    
    let newState = 3; // Disarmato per default
    
    if (armedSectors.length > 0) {
      // Controlla se corrisponde a una modalità specifica
      if (this.sectorsMatch(armedSectors, this.homeSectors)) {
        newState = 0; // Casa
        this.log.debug('Rilevata modalità Casa');
      } else if (this.sectorsMatch(armedSectors, this.nightSectors)) {
        newState = 2; // Notte
        this.log.debug('Rilevata modalità Notte');
      } else if (this.sectorsMatch(armedSectors, this.awaySectors)) {
        newState = 1; // Via
        this.log.debug('Rilevata modalità Via');
      } else {
        // Se i settori armati non corrispondono a nessuna modalità configurata,
        // determina la modalità in base al numero di settori armati
        if (armedSectors.length === sectorsArray.length) {
          newState = 1; // Tutti armati = Via
          this.log.debug('Tutti i settori armati, impostato su Via');
        } else {
          newState = 0; // Parzialmente armato = Casa
          this.log.debug('Settori parzialmente armati, impostato su Casa');
        }
      }
    }
    
    // Aggiorna lo stato solo se è cambiato
    if (this.currentState !== newState) {
      this.log.info(`Stato del sistema cambiato: ${this.getStateDescription(this.currentState)} -> ${this.getStateDescription(newState)}`);
      this.currentState = newState;
      this.targetState = newState;
      
      // Aggiorna lo stato dell'accessorio
      this.updateAccessoryState();
    }
  }
  
  /**
   * Verifica se i settori armati corrispondono alla configurazione di una modalità
   * @param {Array} armedSectors - Array dei settori attualmente armati
   * @param {Array|null} configuredSectors - Array dei settori configurati per una modalità
   * @returns {boolean} True se corrispondono
   */
  sectorsMatch(armedSectors, configuredSectors) {
    if (!configuredSectors) {
      return false; // Se non configurato, non può corrispondere
    }
    
    // Ordina entrambi gli array per il confronto
    const sortedArmed = [...armedSectors].sort((a, b) => a - b);
    const sortedConfigured = [...configuredSectors].sort((a, b) => a - b);
    
    if (sortedArmed.length !== sortedConfigured.length) {
      return false;
    }
    
    return sortedArmed.every((sector, index) => sector === sortedConfigured[index]);
  }
  
  /**
   * Aggiorna lo stato dell'accessorio
   */
  updateAccessoryState() {
    for (const accessory of this.accessories) {
      const service = accessory.getService(Service.SecuritySystem);
      if (service) {
        service.updateCharacteristic(Characteristic.SecuritySystemCurrentState, this.currentState);
        service.updateCharacteristic(Characteristic.SecuritySystemTargetState, this.targetState);
      }
    }
  }
  
  /**
   * Ottiene la descrizione testuale dello stato
   * @param {number} state - Stato numerico
   * @returns {string} Descrizione dello stato
   */
  getStateDescription(state) {
    switch (state) {
      case 0:
        return 'Armato (Casa)';
      case 1:
        return 'Armato (Via)';
      case 2:
        return 'Armato (Notte)';
      case 3:
        return 'Disarmato';
      default:
        return 'Sconosciuto';
    }
  }
  
  /**
   * Crea gli accessori del sistema di sicurezza
   */
  createAccessories() {
    this.log.info('Creazione degli accessori...');
    
    // Genera un UUID univoco per l'accessorio basato sul nome
    const uuid = this.api.hap.uuid.generate(this.name);
    
    // Verifica se l'accessorio esiste già
    let existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    
    if (existingAccessory) {
      this.log.info('Accessorio esistente trovato:', existingAccessory.displayName);
      this.configureSecuritySystemAccessory(existingAccessory);
    } else {
      this.log.info('Creazione di un nuovo accessorio:', this.name);
      
      // Crea un nuovo accessorio
      const accessory = new this.api.platformAccessory(this.name, uuid);
      
      // Configura l'accessorio
      this.configureSecuritySystemAccessory(accessory);
      
      // Registra l'accessorio con Homebridge
      this.api.registerPlatformAccessories('homebridge-elmo', 'ElmoSecuritySystem', [accessory]);
      
      // Aggiungi l'accessorio alla lista
      this.accessories.push(accessory);
    }
  }
  
  /**
   * Configura un accessorio del sistema di sicurezza
   * @param {object} accessory - Accessorio da configurare
   */
  configureSecuritySystemAccessory(accessory) {
    this.log.info('Configurazione dell\'accessorio del sistema di sicurezza:', accessory.displayName);
    
    // Configura le informazioni dell'accessorio
    const informationService = accessory.getService(Service.AccessoryInformation) || 
                              accessory.addService(Service.AccessoryInformation);
    
    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'Elmo')
      .setCharacteristic(Characteristic.Model, this.system)
      .setCharacteristic(Characteristic.SerialNumber, 'ELMO-001')
      .setCharacteristic(Characteristic.FirmwareRevision, '1.0.0');
    
    // Configura il servizio del sistema di sicurezza
    const securityService = accessory.getService(Service.SecuritySystem) || 
                           accessory.addService(Service.SecuritySystem, this.name);
    
    securityService.setCharacteristic(Characteristic.Name, this.name);
    
    // Configura le caratteristiche
    securityService.getCharacteristic(Characteristic.SecuritySystemCurrentState)
      .onGet(this.getCurrentState.bind(this));
    
    securityService.getCharacteristic(Characteristic.SecuritySystemTargetState)
      .onGet(this.getTargetState.bind(this))
      .onSet(this.setTargetState.bind(this));
    
    // Imposta i valori iniziali
    securityService.updateCharacteristic(Characteristic.SecuritySystemCurrentState, this.currentState);
    securityService.updateCharacteristic(Characteristic.SecuritySystemTargetState, this.targetState);
    
    // Gestisci l'evento di identificazione
    accessory.on('identify', () => {
      this.log.info('Identificazione dell\'accessorio:', accessory.displayName);
    });
  }
  
  /**
   * Configura l'accessorio (per accessori esistenti)
   * @param {object} accessory - Accessorio da configurare
   */
  configureAccessory(accessory) {
    this.log.info('Caricamento accessorio dalla cache:', accessory.displayName);
    
    // Aggiungi l'accessorio alla lista
    this.accessories.push(accessory);
    
    // Configura l'accessorio
    this.configureSecuritySystemAccessory(accessory);
  }
  
  /**
   * Ottiene lo stato corrente del sistema
   */
  getCurrentState() {
    this.log.debug('getCurrentState:', this.getStateDescription(this.currentState));
    return this.currentState;
  }
  
  /**
   * Ottiene lo stato target del sistema
   */
  getTargetState() {
    this.log.debug('getTargetState:', this.getStateDescription(this.targetState));
    return this.targetState;
  }
  
  /**
   * Imposta lo stato target del sistema
   * @param {number} state - Stato target
   */
  async setTargetState(state) {
    this.log.info('setTargetState:', this.getStateDescription(state));

    return new Promise((resolve, reject) => {
      // Aggiorna lo stato target
      this.targetState = state;
      
      // Evita operazioni concorrenti
      if (this.operationInProgress) {
        const error = new Error('Operazione già in corso, attendere il completamento');
        this.log.warn(error.message);
        reject(error);
        return;
      }
      
      this.operationInProgress = true;
      
      const pythonScript = path.join(__dirname, 'scripts', 'elmo_client.py');
      let command;
      let sectors = null;
      
      // Determina il comando e i settori da utilizzare in base allo stato target
      if (state === 3) {
        // Disarma il sistema
        command = 'disarm';
        // Per il disarmamento, non specifichiamo settori per disarmare tutto
      } else {
        // Arma il sistema
        command = 'arm';
        
        // Seleziona i settori in base alla modalità
        switch (state) {
          case 0: // Casa
            sectors = this.homeSectors;
            this.log.debug('Modalità Casa - settori:', sectors);
            break;
          case 1: // Via
            sectors = this.awaySectors;
            this.log.debug('Modalità Via - settori:', sectors);
            break;
          case 2: // Notte
            sectors = this.nightSectors;
            this.log.debug('Modalità Notte - settori:', sectors);
            break;
        }
      }
      
      const options = {
        mode: 'json',
        pythonPath: this.pythonPath, // Usa il python del venv
        args: [
          command,
          this.username,
          this.password,
          this.system,
          this.domain,
          this.code
        ],
        timeout: 30000 // Timeout di 30 secondi
      };
      
      // Aggiungi i settori se specificati
      if (sectors && sectors.length > 0) {
        options.args.push(sectors.join(','));
        this.log.debug(`Comando ${command} con settori: ${sectors.join(',')}`);
      } else {
        this.log.debug(`Comando ${command} senza settori specifici`);
      }
      
      if (this.debug) {
        options.args.push('--debug');
      }
      
      this.log.debug(`Esecuzione comando ${command} con timeout di 30 secondi`);
      
      // Esegui il comando
      PythonShell.run(pythonScript, options, (err, results) => {
        this.operationInProgress = false;
        
        if (err) {
          this.log.error(`Errore durante l'esecuzione del comando ${command}:`, err);
          
          // Ripristina lo stato precedente in caso di errore
          this.targetState = this.currentState;
          this.updateAccessoryState();
          
          reject(new Error(`Errore del comando ${command}: ${err.message}`));
          return;
        }
        
        if (!results || results.length === 0) {
          const error = new Error(`Nessun risultato dall'esecuzione del comando ${command}`);
          this.log.error(error.message);
          
          // Ripristina lo stato precedente in caso di errore
          this.targetState = this.currentState;
          this.updateAccessoryState();
          
          reject(error);
          return;
        }
        
        const result = results[0];
        
        if (!result.success) {
          const error = new Error(`Errore nell'esecuzione del comando ${command}: ${result.message}`);
          this.log.error(error.message);
          
          // Ripristina lo stato precedente in caso di errore
          this.targetState = this.currentState;
          this.updateAccessoryState();
          
          reject(error);
          return;
        }
        
        this.log.info(`Comando ${command} eseguito con successo:`, result.message);
        
        // Aggiorna lo stato corrente
        this.currentState = state;
        
        // Aggiorna lo stato dell'accessorio
        this.updateAccessoryState();
        
        // Pianifica un polling immediato per verificare lo stato
        setTimeout(() => {
          this.pollElmoStatus();
        }, 3000);
        
        resolve();
      });
    });
  }
  
  /**
   * Crea un venv Python se non esiste
   */
  ensureVenv() {
    if (!fs.existsSync(this.venvPath)) {
      this.log.info('Creazione di un ambiente virtuale Python per il plugin...');
      const result = spawnSync('python3', ['-m', 'venv', this.venvPath], { encoding: 'utf-8' });
      if (result.error) {
        this.log.error('Errore durante la creazione del venv:', result.error.message);
      } else if (result.status !== 0) {
        this.log.error('Creazione del venv fallita:\n', result.stdout, result.stderr);
      } else {
        this.log.info('Ambiente virtuale Python creato con successo.');
      }
    } else {
      this.log.debug('Ambiente virtuale Python già presente.');
    }
  }

  /**
   * Verifica e installa le dipendenze Python richieste nel venv
   */
  ensurePythonDependencies() {
    const scriptPath = path.join(__dirname, 'scripts', 'install_dependencies.py');
    this.log.info('Verifica delle dipendenze Python nel venv...');
    try {
      const result = spawnSync(this.pythonPath, [scriptPath], { encoding: 'utf-8' });
      if (result.error) {
        this.log.error('Errore durante il controllo delle dipendenze Python:', result.error.message);
      } else if (result.status !== 0) {
        this.log.error('Installazione delle dipendenze Python fallita:\n', result.stdout, result.stderr);
      } else {
        this.log.info('Dipendenze Python verificate/installate correttamente.');
      }
    } catch (err) {
      this.log.error('Eccezione durante il controllo delle dipendenze Python:', err.message);
    }
  }
}

/**
 * Funzione di inizializzazione del plugin
 */
module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
  homebridge.registerPlatform('homebridge-elmo', 'ElmoSecuritySystem', ElmoPlatform);
};
